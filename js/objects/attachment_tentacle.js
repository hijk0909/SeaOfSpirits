// attachment_tentacle.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

const DEFAULT_COLOR = new BABYLON.Color3(1.0, 1.0, 0.0);

// Attachment_Tentacle.js  ─  C案: 連続メッシュ版（継ぎ目なし）rev.3
//
// rev.3 変更点
//   ・根本・先端キャップを廃止（先端は thicknessTip を細くすることで対処）
//   ・parameters に rootOffset を追加
//     → root の出発点を socket.normal の逆方向（ボディ内側）へ指定距離だけずらす
//     → これにより根本がボディに埋まり、根本の隙間が目立たなくなる
//   ・create_root() に offset 引数を追加

export class Attachment_Tentacle extends Attachment {

    // ─────────────────────────────────────────────────────────
    constructor(spirit, socket, parameters = {}) {
        super(spirit, socket);

        const {
            segmentCount  = 4,
            length        = 0.25,
            thicknessBase = 0.5,
            thicknessTip  = 0.1,
            alpha         = 1.0,
            color         = DEFAULT_COLOR,
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

        const mat           = new BABYLON.PBRMaterial('tentacleMat', this.scene);
        mat.albedoColor     = color;
        mat.metallic        = 0.2;
        mat.roughness       = 1.0;
        mat.alpha           = alpha;
        mat.backFaceCulling = true;
        this._tentacleMesh.material = mat;
        this.nodes.push(this._tentacleMesh);

        // ── 作業用一時変数（GC 対策）─────────────────────────
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
        }

        // GPU へ転送
        this._tentacleMesh.updateVerticesData(
            BABYLON.VertexBuffer.PositionKind, pos, false, false
        );
        this._tentacleMesh.updateVerticesData(
            BABYLON.VertexBuffer.NormalKind, nor, false, false
        );
    }

    // ─────────────────────────────────────────────────────────
    dispose() {
        super.dispose();
    }
}


/*
// Attachment_Tentacle.js  ─  C案: 連続メッシュ版（継ぎ目なし）rev.2
//
// rev.2 変更点
//   ・_tentacleMesh を root の子に設定（parent = root）
//     → _updateVertices() はワールド座標ではなく root ローカル座標を出力する
//     → フレームごとに root のワールド逆行列を1回だけ計算し全頂点に適用
//   ・根本・先端にキャップ（蓋）を追加
//     → キャップ専用頂点を末尾に追加（サイド面と法線を分離するため）
//     → キャップ法線は -Z / +Z 方向（各キャップの向きに合わせて毎フレーム更新）

export class Attachment_Tentacle extends Attachment {

    // ─────────────────────────────────────────────────────────
    constructor(spirit, socket, parameters = {}) {
        super(spirit, socket);

        const {
            segmentCount  = 4,
            length        = 0.25,
            thicknessBase = 0.5,
            thicknessTip  = 0.1,
            alpha         = 1.0,
            color         = DEFAULT_COLOR,
        } = parameters;

        this.segments     = [];
        this.segmentCount = segmentCount;
        this.length       = length;

        // ── 骨格ノード（旧版と同一）──────────────────────────
        const root      = this.create_root(socket);
        this._root      = root;           // ← 逆行列計算のため保持
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

        // ── ジオメトリ定数 ────────────────────────────────────
        const TESS       = 8;
        this._tess       = TESS;
        const RING_COUNT = segmentCount + 1;   // サイド面のリング数（先端含む）
        this._ringCount  = RING_COUNT;

        // 各リングの半径を事前計算
        this._ringRadii = new Float32Array(RING_COUNT);
        for (let r = 0; r < RING_COUNT; r++) {
            const t = r / (RING_COUNT - 1);
            this._ringRadii[r] = (thicknessBase * (1 - t) + thicknessTip * t) * 0.5;
        }

        // sin/cos テーブル
        this._cosT = new Float32Array(TESS);
        this._sinT = new Float32Array(TESS);
        for (let t = 0; t < TESS; t++) {
            const a = (2 * Math.PI * t) / TESS;
            this._cosT[t] = Math.cos(a);
            this._sinT[t] = Math.sin(a);
        }

        // ── 頂点レイアウト ────────────────────────────────────
        //
        //  [0 .. SIDE_VERT-1]                     サイド面リング群 (RING_COUNT × TESS)


        const VERT_COUNT  = RING_COUNT * TESS;

        this._positions = new Float32Array(VERT_COUNT * 3);
        this._normals   = new Float32Array(VERT_COUNT * 3);
        this._uvs       = new Float32Array(VERT_COUNT * 2);

        // UV：サイド面
        for (let r = 0; r < RING_COUNT; r++) {
            const v = r / (RING_COUNT - 1);
            for (let t = 0; t < TESS; t++) {
                const vi = (r * TESS + t) * 2;
                this._uvs[vi    ] = t / TESS;
                this._uvs[vi + 1] = v;
            }
        }

        // ── インデックス構築 ──────────────────────────────────
        //   サイド面:      (RING_COUNT-1) × TESS × 2 三角形
        const TRIANGLE_COUNT  = (RING_COUNT - 1) * TESS * 2;
        const indices   = new Int32Array(TRIANGLE_COUNT * 3);
        let   idx       = 0;

        // サイド面
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

        // ── 連続メッシュを生成 ────────────────────────────────
        this._tentacleMesh        = new BABYLON.Mesh('tentacle_mesh', this.scene);
        this._tentacleMesh.parent = root;
        this.nodes.push(this._tentacleMesh);

        const vd     = new BABYLON.VertexData();
        vd.positions = this._positions;
        vd.normals   = this._normals;
        vd.uvs       = this._uvs;
        vd.indices   = indices;
        vd.applyToMesh(this._tentacleMesh, true);  // updatable = true

        const mat           = new BABYLON.PBRMaterial('tentacleMat', this.scene);
        mat.albedoColor     = color;
        mat.metallic        = 0.2;
        mat.roughness       = 1.0;
        mat.alpha           = alpha;
        mat.backFaceCulling = true;
        this._tentacleMesh.material = mat;
        this.nodes.push(this._tentacleMesh);

        // ── 作業用一時変数（GC 対策）─────────────────────────
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

        // _updateVertices() 用
        this._invRootWorld = new BABYLON.Matrix();   // ← rev.2 追加
    }

    // ─────────────────────────────────────────────────────────
    update(time, delta) {
        if (this.segments.length <= 1) return;

        // ── 骨格の回転計算（旧版と完全に同一）─────────────────
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

        // ── 頂点の更新 ────────────────────────────────────────
        this._updateVertices();

        super.update(time, delta);
    }

    // ─────────────────────────────────────────────────────────
    // _updateVertices()
    //
    //  座標系：
    //    各 pivot のワールド行列からワールド座標を求め、
    //    root のワールド逆行列を掛けて root ローカル座標に変換する。
    //    （mesh.parent = root なので頂点は root ローカル空間で渡す必要がある）
    //
    //  法線変換：
    //    均一スケール前提で、法線も同じ逆行列で TransformNormal する。
    //    （不均一スケールを持つ場合は逆行列の転置が必要だが、
    //      ゲームキャラのスケールは均一が一般的なので省略）
    //
    //  BABYLON.js の行列はメモリ上 列優先（column-major）で格納されており、
    //  m[] のインデックスは以下の通り：
    //    [ m0  m1  m2  m3  ]   X軸（列0）
    //    [ m4  m5  m6  m7  ]   Y軸（列1）
    //    [ m8  m9  m10 m11 ]   Z軸（列2）
    //    [ m12 m13 m14 m15 ]   平行移動（列3）
    //  ただし TransformCoordinates は行ベクトル × 行列 の規約なので
    //    P' = P * M  と計算する（上記レイアウトで行ベクトル積）。
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
        const inv = this._invRootWorld.m;   // Float32Array への参照（GC なし）

        // ── 共通のローカル変換ヘルパー（インライン展開で関数呼び出しコストゼロ）──
        // TransformCoordinates: (wx,wy,wz) → root ローカル座標
        //   lx = wx*inv[0] + wy*inv[4] + wz*inv[8]  + inv[12]
        //   ly = wx*inv[1] + wy*inv[5] + wz*inv[9]  + inv[13]
        //   lz = wx*inv[2] + wy*inv[6] + wz*inv[10] + inv[14]
        //
        // TransformNormal: (wx,wy,wz) → root ローカル方向（平行移動成分なし）
        //   lx = wx*inv[0] + wy*inv[4] + wz*inv[8]
        //   ly = wx*inv[1] + wy*inv[5] + wz*inv[9]
        //   lz = wx*inv[2] + wy*inv[6] + wz*inv[10]

        // inv の頻出成分をローカル変数に展開（アクセスコスト削減）
        const i0  = inv[0],  i1  = inv[1],  i2  = inv[2];
        const i4  = inv[4],  i5  = inv[5],  i6  = inv[6];
        const i8  = inv[8],  i9  = inv[9],  i10 = inv[10];
        const i12 = inv[12], i13 = inv[13], i14 = inv[14];

        // ── サイド面リング ────────────────────────────────────
        for (let r = 0; r < RING_COUNT; r++) {

            let wm;
            let wcx, wcy, wcz;   // ワールド中心座標

            if (r < segCount) {
                wm  = this.segments[r].pivot.getWorldMatrix().m;
                wcx = wm[12];  wcy = wm[13];  wcz = wm[14];
            } else {
                // 先端リング：最終 pivot から Z+ 方向へ length 進む
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

                pos[vi3    ] = lcx + rad * (c * lax + s * lbx);
                pos[vi3 + 1] = lcy + rad * (c * lay + s * lby);
                pos[vi3 + 2] = lcz + rad * (c * laz + s * lbz);

                nor[vi3    ] = c * lax + s * lbx;
                nor[vi3 + 1] = c * lay + s * lby;
                nor[vi3 + 2] = c * laz + s * lbz;
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

    // ─────────────────────────────────────────────────────────
    dispose() {
        super.dispose();
    }
}
*/
/*
export class Attachment_Tentacle extends Attachment {
    constructor(spirit, socket, parameters = {}) {
        super(spirit, socket);

        const {
            segmentCount  = 4,
            length        = 0.25,
            thicknessBase = 0.5,
            thicknessTip  = 0.1,
            alpha         = 1.0,
            color         = DEFAULT_COLOR,
        } = parameters;

        this.segments     = [];   // { pivot } の配列
        this.segmentCount = segmentCount;
        this.length       = length;

        // 骨格ノード 
        const root      = this.create_root(socket);
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
            this.segments.push({ pivot });
            prevPivot = pivot;
        }

        // ジオメトリ定数
        const TESS        = 8;          // 円周方向の分割数
        this._tess        = TESS;
        const RING_COUNT  = segmentCount + 1;  // リング数（先端リングを含む）
        this._ringCount   = RING_COUNT;

        // 各リングの半径を事前計算
        //   ring 0  = thicknessBase/2（根元）
        //   ring N  = thicknessTip/2（先端）
        this._ringRadii = new Float32Array(RING_COUNT);
        for (let r = 0; r < RING_COUNT; r++) {
            const t = r / (RING_COUNT - 1);           // 0.0 → 1.0
            this._ringRadii[r] = (thicknessBase * (1 - t) + thicknessTip * t) * 0.5;
        }

        // sin/cos テーブル（毎フレーム Math.sin/cos を計算しない）
        this._cosT = new Float32Array(TESS);
        this._sinT = new Float32Array(TESS);
        for (let t = 0; t < TESS; t++) {
            const a = (2 * Math.PI * t) / TESS;
            this._cosT[t] = Math.cos(a);
            this._sinT[t] = Math.sin(a);
        }

        // 頂点バッファを事前確保
        // 頂点数 = RING_COUNT × TESS
        //   （キャップは付けない。根元は親メッシュに接着するので不要。
        //     先端は細いのでほぼ目立たない。必要なら後で追加可能。）[TODO]
        const VERT_COUNT = RING_COUNT * TESS;
        this._positions  = new Float32Array(VERT_COUNT * 3);
        this._normals    = new Float32Array(VERT_COUNT * 3);
        this._uvs        = new Float32Array(VERT_COUNT * 2);

        // UV は変化しないのでコンストラクタで一度だけ設定
        for (let r = 0; r < RING_COUNT; r++) {
            const v = r / (RING_COUNT - 1);
            for (let t = 0; t < TESS; t++) {
                const vi      = (r * TESS + t) * 2;
                this._uvs[vi    ] = t / TESS;
                this._uvs[vi + 1] = v;
            }
        }

        // インデックス（変化しないのでコンストラクタで一度だけ）
        // 各セグメント（隣接2リング間）を TESS 個の四角形 → 各2三角形
        const QUAD_COUNT = (RING_COUNT - 1) * TESS;
        const indices    = new Int32Array(QUAD_COUNT * 6);
        let   idx        = 0;
        for (let r = 0; r < RING_COUNT - 1; r++) {
            for (let t = 0; t < TESS; t++) {
                const tNext = (t + 1) % TESS;
                const a = r       * TESS + t;
                const b = r       * TESS + tNext;
                const c = (r + 1) * TESS + t;
                const d = (r + 1) * TESS + tNext;
                // 三角形 1
                indices[idx++] = a;
                indices[idx++] = c;
                indices[idx++] = b;
                // 三角形 2
                indices[idx++] = b;
                indices[idx++] = c;
                indices[idx++] = d;
            }
        }

        // 連続メッシュを生成
        // 最初に適当な座標で頂点データを作り、update() で毎フレーム上書きする
        this._tentacleMesh = new BABYLON.Mesh('tentacle_mesh', this.scene);
        this._tentacleMesh.parent = root;
        this.nodes.push(this._tentacleMesh);

        const vd       = new BABYLON.VertexData();
        vd.positions   = this._positions;   // Float32Array のまま渡せる
        vd.normals     = this._normals;
        vd.uvs         = this._uvs;
        vd.indices     = indices;
        vd.applyToMesh(this._tentacleMesh, true);  // updatable = true

        const mat          = new BABYLON.PBRMaterial('tentacleMat', this.scene);
        mat.albedoColor    = color;
        mat.metallic       = 0.2;
        mat.roughness      = 1.0;
        mat.alpha          = alpha;
        mat.backFaceCulling = true; //[TODO] キャップを被せるなら true 、そうでないなら false のほうが見栄えは良い
        this._tentacleMesh.material = mat;
        this.nodes.push(this._tentacleMesh);

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

        // ワールド行列から取り出す際の作業用ベクトル（GC 対策）
        this._ringCenter = new BABYLON.Vector3();
        this._ringAxisX  = new BABYLON.Vector3();
        this._ringAxisY  = new BABYLON.Vector3();
        this._tmpVec3    = new BABYLON.Vector3();
    }

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

            const maxRad     = (60 * Math.PI) / 180;
            const w          = Math.min(1.0, Math.abs(pivot.rotationQuaternion.w));
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
    //   各 pivot のワールド行列を読み取り、
    //   対応するリング（TESS 個の頂点）の座標と法線を書き換える。
    //
    //   リングの配置ルール：
    //     ring[i]  ← segments[i].pivot のワールド原点
    //               （つまり root ～ 最終 pivot まで）
    //     ring[N]  ← 最終 pivot から length だけ Z+ 方向に進んだ先端
    //
    //   これにより隣接リングは必ず「前のセグメントの先端 = 次のセグメントの根本」
    //   の同一点を共有するため、継ぎ目が構造的に発生しない。
    // ─────────────────────────────────────────────────────────
    _updateVertices() {
        const TESS      = this._tess;
        const RING_COUNT = this._ringCount;
        const pos       = this._positions;
        const nor       = this._normals;
        const radii     = this._ringRadii;
        const cosT      = this._cosT;
        const sinT      = this._sinT;
        const segCount  = this.segments.length;   // = segmentCount
        const length    = this.length;

        for (let r = 0; r < RING_COUNT; r++) {

            // ── このリングの中心と向き（ローカル X/Y 軸）を求める ──
            //
            // ring[0..segCount-1] → segments[r].pivot のワールド原点
            // ring[segCount]      → 最終 pivot の Z+ 方向 length 先
            //
            let worldMat;
            if (r < segCount) {
                worldMat = this.segments[r].pivot.getWorldMatrix();
                // 中心 = ワールド行列の平行移動成分
                this._ringCenter.set(
                    worldMat.m[12],
                    worldMat.m[13],
                    worldMat.m[14]
                );
            } else {
                // 先端リング：最終 pivot のワールド行列で Z+ を length だけ進む
                worldMat = this.segments[segCount - 1].pivot.getWorldMatrix();
                // ワールド Z 軸（列ベクトル [m8, m9, m10] がローカル Z 軸のワールド方向）
                const zx = worldMat.m[8];
                const zy = worldMat.m[9];
                const zz = worldMat.m[10];
                this._ringCenter.set(
                    worldMat.m[12] + zx * length,
                    worldMat.m[13] + zy * length,
                    worldMat.m[14] + zz * length
                );
            }

            // ローカル X 軸 = ワールド行列の X 列 [m0, m1, m2]
            // ローカル Y 軸 = ワールド行列の Y 列 [m4, m5, m6]
            //（円をこの平面上に描く ＝ ローカル XY 平面 = セグメント断面）
            const axXx = worldMat.m[0],  axXy = worldMat.m[1],  axXz = worldMat.m[2];
            const axYx = worldMat.m[4],  axYy = worldMat.m[5],  axYz = worldMat.m[6];

            const cx = this._ringCenter.x;
            const cy = this._ringCenter.y;
            const cz = this._ringCenter.z;
            const rad = radii[r];

            for (let t = 0; t < TESS; t++) {
                const c   = cosT[t];
                const s   = sinT[t];
                const vi3 = (r * TESS + t) * 3;

                // 頂点座標 = 中心 + R*(cos*X + sin*Y)
                pos[vi3    ] = cx + rad * (c * axXx + s * axYx);
                pos[vi3 + 1] = cy + rad * (c * axXy + s * axYy);
                pos[vi3 + 2] = cz + rad * (c * axXz + s * axYz);

                // 法線 = 正規化（cos*X + sin*Y）
                // ここでは X/Y 軸が既に単位ベクトルなのでそのまま使える
                nor[vi3    ] = c * axXx + s * axYx;
                nor[vi3 + 1] = c * axXy + s * axYy;
                nor[vi3 + 2] = c * axXz + s * axYz;
            }
        }

        // VertexBuffer を GPU へ転送（updatable メッシュなので差分転送される）
        this._tentacleMesh.updateVerticesData(
            BABYLON.VertexBuffer.PositionKind, pos, false, false
        );
        this._tentacleMesh.updateVerticesData(
            BABYLON.VertexBuffer.NormalKind, nor, false, false
        );
    }

    dispose() {
        if (this.segments.length > 0){
            // console.log("DISPOSE Segments", this.segments.length);
            for (const segment of this.segments){
                segment.pivot.dispose();
                segment.pivot = null;
            }
            this.segments = null;
        }
        super.dispose();
    }
}
*/
/*
const DEFAULT_COLOR = new BABYLON.Color3(1.0, 1.0, 0.0);

export class Attachment_Tentacle extends Attachment{

    constructor(spirit, socket, parameters = {}){
        super(spirit, socket);

        const {segmentCount = 4, length=0.25, thicknessBase=0.5, thicknessTip=0.1, alpha=1.0, color=DEFAULT_COLOR} = parameters;
        this.segments = []; // { pivot, mesh } のペアを格納

        const root = this.create_root(socket);

        let prevPivot = root;
        const length_expand = 1.15; //メッシュの拡大率

        for (let i = 0; i < segmentCount; i++) {
            // （１）pivotノード: 親の「先端」に置く
            const pivot = new BABYLON.TransformNode(`tentacle_pivot_${i}`, this.scene);
            pivot.parent = prevPivot;
            // 最初のpivotはrootそのもの(0,0,0)、
            // 2番目以降は前のpivotのZ+ length先
            pivot.position = i === 0
                ? new BABYLON.Vector3(0, 0, 0)
                : new BABYLON.Vector3(0, 0, length);
            pivot.rotationQuaternion = BABYLON.Quaternion.Identity();
            this.nodes.push(pivot);

            // （２）cylinder mesh: pivotを起点にZ方向へ length/2 オフセット
            //    (cylinderはデフォルトでY軸方向なので、X軸で90度回転してZ方向に向ける)
            const thicknessStep = (thicknessBase - thicknessTip) / segmentCount;
            const mesh = BABYLON.MeshBuilder.CreateCylinder( `tentacle_seg_${i}`,
                { height: length * length_expand, 
                  diameterBottom: thicknessTip + thicknessStep * (segmentCount - i),
                  diameterTop: thicknessTip + thicknessStep * (segmentCount - (i+1)),
                  tessellation: 8  },
                this.scene
            );
            mesh.parent = pivot;
            mesh.position = new BABYLON.Vector3(0, 0, length * length_expand / 2);
            mesh.rotation.x = Math.PI / 2; // Y軸cylinderをZ方向に向ける
            this.nodes.push(mesh);

            const mat = new BABYLON.PBRMaterial("tentacleMat", this.scene);
            mat.albedoColor = color;
            mat.metallic = 0.2;
            mat.roughness = 1.0;
            mat.alpha = alpha;
            mesh.material = mat;

            this.segments.push({ pivot, mesh });
            prevPivot = pivot;

            this.straightQuat = BABYLON.Quaternion.Identity(); // 真っすぐ＝親と同じ向き＝ローカルのIdentity回転
            this.tmpFlow = new BABYLON.Vector3();
            this.tmpLocalFlowDir = new BABYLON.Vector3();
            this.tmpAxis = new BABYLON.Vector3();

            this.tmpFlowQuat = new BABYLON.Quaternion();
            this.tmpDesiredQuat = new BABYLON.Quaternion();
            this.tmpClampedQuat = new BABYLON.Quaternion();

            this.tmpInvParentWorld = new BABYLON.Matrix();
            this.UP = BABYLON.Vector3.Up();
            this.RIGHT = BABYLON.Vector3.Right();
        }
    }

    update(time, delta){
        if (this.segments.length <= 1) return;

        if(this.spirit.velocity.length() > 0.0001){
            this.tmpFlow.copyFrom(this.spirit.velocity);
        }else{
            this.tmpFlow.copyFrom(this.spirit.get_forward_vector());
        }
        this.tmpFlow.normalize();

        for (let i = 1; i < this.segments.length; i++) {
            const { pivot } = this.segments[i];

            //  移動方向をこのpivotの親のローカル空間に変換する
            const parentNode = this.segments[i - 1].pivot;
            const parentWorldMatrix = parentNode.getWorldMatrix();
            parentWorldMatrix.invertToRef(this.tmpInvParentWorld);

            // flow　をこのpivotのローカル空間へ
            BABYLON.Vector3.TransformNormalToRef(
                this.tmpFlow,
                this.tmpInvParentWorld,
                this.tmpLocalFlowDir
            )
            this.tmpLocalFlowDir.normalize();
            
            // ローカル空間で移動方向を向くQuaternionを作成
            const up = Math.abs(this.tmpLocalFlowDir.y) < 0.99 ? this.UP : this.RIGHT ;
            BABYLON.Quaternion.FromLookDirectionLHToRef(this.tmpLocalFlowDir, up, this.tmpFlowQuat);

            //「真っ直ぐ」と「flow方向」をブレンド（末端ほど移動の影響を弱く）
            const flowInfluence = (1 - (i / this.segments.length)) * 0.4; // 最大30%
            BABYLON.Quaternion.SlerpToRef(
                this.straightQuat,
                this.tmpFlowQuat,
                flowInfluence,
                this.tmpDesiredQuat
            );

            // 現在の回転をdesiredQuatへ徐々に近づける（慣性）
            const slerpSpeed = Math.min(delta * 0.10, 0.1); // deltaベースで安定化
            BABYLON.Quaternion.SlerpToRef(
                pivot.rotationQuaternion,
                this.tmpDesiredQuat,
                slerpSpeed,
                pivot.rotationQuaternion
            );

            // 最大曲がり角度制限
            const maxRad = (60 * Math.PI) / 180;
            const w = Math.min(1.0, Math.abs(pivot.rotationQuaternion.w));
            const currentAngle = 2 * Math.acos(w);
            if (currentAngle > maxRad) {
                this.tmpAxis.copyFrom(pivot.rotationQuaternion);
                this.tmpAxis.normalize();
                BABYLON.Quaternion.RotationAxisToRef(this.tmpAxis, maxRad, this.tmpClampedQuat);
                pivot.rotationQuaternion.copyFrom(this.tmpClampedQuat);
            }
        }
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}
*/