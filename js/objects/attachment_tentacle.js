// attachment_tentacle.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

export class Attachment_Tentacle extends Attachment {

    // ─────────────────────────────────────────────────────────
    constructor(spirit, socket, parameters = {}) {
        super(spirit, socket);

        const {
            segmentCount  = 4,
            length        = 0.25,
            thicknessBase = 0.5,
            thicknessTip  = 0.1,
            material_key  = "",
            offset        = 0.0,
        } = parameters;

        this.segments     = [];
        this.segmentCount = segmentCount;
        this.length       = length;

        // 骨格ノード
        const root      = this.create_root(socket, offset);
        this._root      = root;
        let   prevPivot = root;

        for (let i = 0; i < segmentCount; i++) {
            const pivot = new BABYLON.TransformNode(
                `tentacle_pivot_${i}`, this.scene
            );
            pivot.parent   = prevPivot;
            pivot.position = i === 0
                ? new BABYLON.Vector3(0, 0, 0)
                : new BABYLON.Vector3(0, 0, length);
            pivot.rotationQuaternion = BABYLON.Quaternion.Identity();
            this.nodes.push(pivot);
            this.segments.push({ pivot });
            prevPivot = pivot;
        }

        // ジオメトリ定数
        const TESS       = 8;
        this._tess       = TESS;
        const RING_COUNT = segmentCount + 1;   // リング数（先端リングを含む）
        this._ringCount  = RING_COUNT;

        // 各リングの半径を事前計算（根本 → 先端で線形補間）
        this._ringRadii = new Float32Array(RING_COUNT);
        for (let r = 0; r < RING_COUNT; r++) {
            const t = r / (RING_COUNT - 1);
            this._ringRadii[r] = (thicknessBase * (1 - t) + thicknessTip * t) * 0.5;
        }

        // sin/cos テーブル（毎フレームの三角関数呼び出しをゼロ）
        this._cosT = new Float32Array(TESS);
        this._sinT = new Float32Array(TESS);
        for (let t = 0; t < TESS; t++) {
            const a    = (2 * Math.PI * t) / TESS;
            this._cosT[t] = Math.cos(a);
            this._sinT[t] = Math.sin(a);
        }

        // 頂点・インデックスバッファを事前確保
        // 頂点数 = RING_COUNT × TESS
        const VERT_COUNT = RING_COUNT * TESS;
        this._positions  = new Float32Array(VERT_COUNT * 3);
        this._normals    = new Float32Array(VERT_COUNT * 3);
        this._uvs        = new Float32Array(VERT_COUNT * 2);

        // UV（変化しないのでコンストラクタで一度だけ設定）
        for (let r = 0; r < RING_COUNT; r++) {
            const v = r / (RING_COUNT - 1);
            for (let t = 0; t < TESS; t++) {
                const vi          = (r * TESS + t) * 2;
                this._uvs[vi    ] = t / TESS;
                this._uvs[vi + 1] = v;
            }
        }

        // インデックス（変化しないのでコンストラクタで一度だけ）
        // 隣接する2リング間を TESS 個の四角形（各2三角形）で繋ぐ
        const indices = new Int32Array((RING_COUNT - 1) * TESS * 6);
        let   idx     = 0;
        for (let r = 0; r < RING_COUNT - 1; r++) {
            for (let t = 0; t < TESS; t++) {
                const tNext = (t + 1) % TESS;
                const a = r       * TESS + t;
                const b = r       * TESS + tNext;
                const c = (r + 1) * TESS + t;
                const d = (r + 1) * TESS + tNext;
                indices[idx++] = a;  indices[idx++] = c;  indices[idx++] = b;
                indices[idx++] = b;  indices[idx++] = c;  indices[idx++] = d;
            }
        }

        // 連続メッシュ生成
        this._invRootWorld        = new BABYLON.Matrix();
        this._tentacleMesh        = new BABYLON.Mesh('tentacle_mesh', this.scene);
        this._tentacleMesh.parent = root;

        const vd     = new BABYLON.VertexData();
        vd.positions = this._positions;
        vd.normals   = this._normals;
        vd.uvs       = this._uvs;
        vd.indices   = indices;
        vd.applyToMesh(this._tentacleMesh, true);  // updatable = true

        // マテリアルの設定
        const mat           = this.spirit.shared_materials.get(material_key);
        mat.backFaceCulling = true;
        this._tentacleMesh.material = mat;

        this.nodes.push(this._tentacleMesh);

        // [CAP] キャップメッシュ（先端リング用） 
        // 頂点：中心1点 + リング TESS 点 = TESS+1 点
        // 三角形：TESS 個（中心と各リング辺をつなぐ）
        const CAP_VERT_COUNT = TESS + 1;
        this._capPositions   = new Float32Array(CAP_VERT_COUNT * 3);
        this._capNormals     = new Float32Array(CAP_VERT_COUNT * 3);
        this._capUVs         = new Float32Array(CAP_VERT_COUNT * 2);

        // キャップ UV（中心 = (0.5, 0.5)、リング = 円周上）
        this._capUVs[0] = 0.5;
        this._capUVs[1] = 0.5;
        for (let t = 0; t < TESS; t++) {
            const ui = (1 + t) * 2;
            this._capUVs[ui    ] = 0.5 + 0.5 * this._cosT[t];
            this._capUVs[ui + 1] = 0.5 + 0.5 * this._sinT[t];
        }

        // キャップ インデックス（中心=0、リング=1..TESS）
        // 外向き法線に合わせる（チューブ外側に向く扇形）
        const capIndices = new Int32Array(TESS * 3);
        let ci = 0;
        for (let t = 0; t < TESS; t++) {
            const tNext = (t + 1) % TESS;
            capIndices[ci++] = 0;           // 中心
            capIndices[ci++] = 1 + tNext;   // 次の頂点
            capIndices[ci++] = 1 + t;       // 現在の頂点
        }

        this._tentacleCapMesh        = new BABYLON.Mesh('tentacle_cap_mesh', this.scene);
        this._tentacleCapMesh.parent = root;

        const capVd     = new BABYLON.VertexData();
        capVd.positions = this._capPositions;
        capVd.normals   = this._capNormals;
        capVd.uvs       = this._capUVs;
        capVd.indices   = capIndices;
        capVd.applyToMesh(this._tentacleCapMesh, true);  // updatable = true

        this._tentacleCapMesh.material = mat;

        this.nodes.push(this._tentacleCapMesh);

        // 作業用一時変数（GC 対策）
        this.straightQuat      = BABYLON.Quaternion.Identity();
        this.tmpFlow           = new BABYLON.Vector3();
        this.tmpLocalFlowDir   = new BABYLON.Vector3();
        this.tmpAxis           = new BABYLON.Vector3();
        this.tmpFlowQuat       = new BABYLON.Quaternion();
        this.tmpDesiredQuat    = new BABYLON.Quaternion();
        this.tmpClampedQuat    = new BABYLON.Quaternion();
        this.tmpInvParentWorld = new BABYLON.Matrix();
        this.UP                = BABYLON.Vector3.Up();
        this.RIGHT             = BABYLON.Vector3.Right();
    }

    // ─────────────────────────────────────────────────────────
    update(time, delta) {
        if (this.segments.length <= 1) return;

        // 骨格の回転計算
        if (this.spirit.velocity.length() > 0.0001) {
            this.tmpFlow.copyFrom(this.spirit.velocity);
        } else {
            this.tmpFlow.copyFrom(this.spirit.get_forward_vector());
        }
        this.tmpFlow.normalize();

        for (let i = 1; i < this.segments.length; i++) {
            const { pivot } = this.segments[i];

            const parentNode        = this.segments[i - 1].pivot;
            const parentWorldMatrix = parentNode.getWorldMatrix();
            parentWorldMatrix.invertToRef(this.tmpInvParentWorld);

            BABYLON.Vector3.TransformNormalToRef(
                this.tmpFlow,
                this.tmpInvParentWorld,
                this.tmpLocalFlowDir
            );
            this.tmpLocalFlowDir.normalize();

            const up = Math.abs(this.tmpLocalFlowDir.y) < 0.99
                ? this.UP : this.RIGHT;
            BABYLON.Quaternion.FromLookDirectionLHToRef(
                this.tmpLocalFlowDir, up, this.tmpFlowQuat
            );

            const flowInfluence = (1 - (i / this.segments.length)) * 0.4;
            BABYLON.Quaternion.SlerpToRef(
                this.straightQuat,
                this.tmpFlowQuat,
                flowInfluence,
                this.tmpDesiredQuat
            );

            const slerpSpeed = Math.min(delta * 0.10, 0.1);
            BABYLON.Quaternion.SlerpToRef(
                pivot.rotationQuaternion,
                this.tmpDesiredQuat,
                slerpSpeed,
                pivot.rotationQuaternion
            );

            const maxRad       = (60 * Math.PI) / 180;
            const w            = Math.min(1.0, Math.abs(pivot.rotationQuaternion.w));
            const currentAngle = 2 * Math.acos(w);
            if (currentAngle > maxRad) {
                this.tmpAxis.copyFrom(pivot.rotationQuaternion);
                this.tmpAxis.normalize();
                BABYLON.Quaternion.RotationAxisToRef(
                    this.tmpAxis, maxRad, this.tmpClampedQuat
                );
                pivot.rotationQuaternion.copyFrom(this.tmpClampedQuat);
            }
        }

        // 頂点の更新
        this._updateVertices();

        super.update(time, delta);
    }

    // ─────────────────────────────────────────────────────────
    // _updateVertices()
    //
    //  各 pivot のワールド行列を読み取り、対応するリングの頂点座標と法線を
    //  root のローカル空間に変換して _positions / _normals に書き込む。
    //
    //  リングの配置：
    //    ring[i]        ← segments[i].pivot のワールド原点  (i = 0..segCount-1)
    //    ring[segCount] ← 最終 pivot から Z+ 方向へ length 進んだ先端
    //
    //  座標系メモ（BABYLON.js の行列レイアウト）：
    //    m[] は列優先（column-major）で格納。
    //    m[0..2]   = ローカル X 軸のワールド方向
    //    m[4..6]   = ローカル Y 軸のワールド方向
    //    m[8..10]  = ローカル Z 軸のワールド方向
    //    m[12..14] = ワールド平行移動
    //    TransformCoordinates は行ベクトル規約 → P' = P * M で計算する。
    // ─────────────────────────────────────────────────────────
    _updateVertices() {
        const TESS       = this._tess;
        const RING_COUNT = this._ringCount;
        const pos        = this._positions;
        const nor        = this._normals;
        const radii      = this._ringRadii;
        const cosT       = this._cosT;
        const sinT       = this._sinT;
        const segCount   = this.segments.length;
        const length     = this.length;

        // root のワールド逆行列をフレームあたり1回だけ計算
        this._root.getWorldMatrix().invertToRef(this._invRootWorld);
        const inv = this._invRootWorld.m;

        // inv の頻出成分をローカル変数に展開（配列アクセスコスト削減）
        const i0  = inv[0],  i1  = inv[1],  i2  = inv[2];
        const i4  = inv[4],  i5  = inv[5],  i6  = inv[6];
        const i8  = inv[8],  i9  = inv[9],  i10 = inv[10];
        const i12 = inv[12], i13 = inv[13], i14 = inv[14];

        for (let r = 0; r < RING_COUNT; r++) {

            // このリングのワールド中心座標と基底軸を求める
            let wm;
            let wcx, wcy, wcz;

            if (r < segCount) {
                wm  = this.segments[r].pivot.getWorldMatrix().m;
                wcx = wm[12];
                wcy = wm[13];
                wcz = wm[14];
            } else {
                // 先端リング：最終 pivot の Z+ 方向へ length 進む
                wm  = this.segments[segCount - 1].pivot.getWorldMatrix().m;
                wcx = wm[12] + wm[8]  * length;
                wcy = wm[13] + wm[9]  * length;
                wcz = wm[14] + wm[10] * length;
            }

            // ワールド中心 → root ローカル中心
            const lcx = wcx * i0 + wcy * i4 + wcz * i8  + i12;
            const lcy = wcx * i1 + wcy * i5 + wcz * i9  + i13;
            const lcz = wcx * i2 + wcy * i6 + wcz * i10 + i14;

            // ワールド X 軸 → root ローカル X 軸
            const wax = wm[0], way = wm[1], waz = wm[2];
            const lax = wax * i0 + way * i4 + waz * i8;
            const lay = wax * i1 + way * i5 + waz * i9;
            const laz = wax * i2 + way * i6 + waz * i10;

            // ワールド Y 軸 → root ローカル Y 軸
            const wbx = wm[4], wby = wm[5], wbz = wm[6];
            const lbx = wbx * i0 + wby * i4 + wbz * i8;
            const lby = wbx * i1 + wby * i5 + wbz * i9;
            const lbz = wbx * i2 + wby * i6 + wbz * i10;

            const rad = radii[r];

            for (let t = 0; t < TESS; t++) {
                const c   = cosT[t];
                const s   = sinT[t];
                const vi3 = (r * TESS + t) * 3;

                // 頂点座標 = 中心 + R * (cos*X + sin*Y)
                pos[vi3    ] = lcx + rad * (c * lax + s * lbx);
                pos[vi3 + 1] = lcy + rad * (c * lay + s * lby);
                pos[vi3 + 2] = lcz + rad * (c * laz + s * lbz);

                // 法線 = 正規化（cos*X + sin*Y）
                // X/Y 軸は既に単位ベクトルなので長さは 1 のまま
                nor[vi3    ] = c * lax + s * lbx;
                nor[vi3 + 1] = c * lay + s * lby;
                nor[vi3 + 2] = c * laz + s * lbz;
            }

            // [CAP] 先端リングの計算結果を先端キャップのメッシュ座標に反映
            if (r === RING_COUNT - 1) {   
                const wcZx = wm[8],  wcZy = wm[9],  wcZz = wm[10];
                const lcZx = wcZx * i0 + wcZy * i4 + wcZz * i8;
                const lcZy = wcZx * i1 + wcZy * i5 + wcZz * i9;
                const lcZz = wcZx * i2 + wcZy * i6 + wcZz * i10;

                this._capPositions[0] = lcx;
                this._capPositions[1] = lcy;
                this._capPositions[2] = lcz;
                this._capNormals[0]   = lcZx;
                this._capNormals[1]   = lcZy;
                this._capNormals[2]   = lcZz;

                for (let t = 0; t < TESS; t++) {
                    const c   = cosT[t];
                    const s   = sinT[t];
                    const vi3 = (1 + t) * 3;
                    this._capPositions[vi3    ] = lcx + rad * (c * lax + s * lbx);
                    this._capPositions[vi3 + 1] = lcy + rad * (c * lay + s * lby);
                    this._capPositions[vi3 + 2] = lcz + rad * (c * laz + s * lbz);
                    this._capNormals[vi3    ]   = lcZx;
                    this._capNormals[vi3 + 1]   = lcZy;
                    this._capNormals[vi3 + 2]   = lcZz;
                }

                this._tentacleCapMesh.updateVerticesData(
                    BABYLON.VertexBuffer.PositionKind, this._capPositions, false, false
                );
                this._tentacleCapMesh.updateVerticesData(
                    BABYLON.VertexBuffer.NormalKind, this._capNormals, false, false
                );
            }
        }

        // GPU へ転送
        this._tentacleMesh.updateVerticesData(
            BABYLON.VertexBuffer.PositionKind, pos, false, false
        );
        this._tentacleMesh.updateVerticesData(
            BABYLON.VertexBuffer.NormalKind, nor, false, false
        );
    }

    dispose() {
        super.dispose();
    }
}