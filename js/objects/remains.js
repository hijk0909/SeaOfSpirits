// remains.js
import { GLOBALS } from '../GameConst.js';
import { Drawable } from "./base_drawable.js";

const MAX_REMAINS = 2000;
const ZERO_SCALE    = new BABYLON.Vector3(0, 0, 0);
const ZERO_POSITION = new BABYLON.Vector3(0, 0, 0);
const ALPHA_START     = 0.2;
const ALPHA_REMAINING = 0.1;

const SCALE_FACTOR = 0.75;
const DOWN_SPEED  = 0.001;
const DEPTH_SPEED = 0.001;
const ROTATE_SPEED = 0.002;

const ST_APPEARING    = 0;
const ST_TRANSPARENT  = 1;
const ST_MOVE         = 2;
const ST_REMAINING    = 3;
const ST_DISAPPEARING = 4;

const ST_APPEARING_COUNT        = 60;   // フレーム数（整数カウンタ）
const ST_TRANSPARENT_COUNT      = 60;   // フレーム数（整数カウンタ）
const ST_REMAINING_PERIOD       = 900;  // 秒（delta/1000 で加算）
const ST_DISAPPEARING_COUNT     = 60;  // フレーム数（整数カウンタ）

export class Remains extends Drawable {
    constructor(scene, cls) {
        super(scene, cls);
        this.mesh = null;

        this.matrixBuffer = new Float32Array(MAX_REMAINS * 16);
        this.colorBuffer  = new Float32Array(MAX_REMAINS * 4);
        this.flags = new Array(MAX_REMAINS).fill(false);

        // 各インスタンスの状態を保持する配列
        this.stats = new Array(MAX_REMAINS).fill(null).map(() => ({
            scale:      1.0,
            state:      ST_APPEARING,
            counter:    0,
            position:   new BABYLON.Vector3(),
            axis:       new BABYLON.Vector3(0, 1, 0)
        }));

        this.tmp_position = new BABYLON.Vector3(0, 0, 0);
        this.tmp_scale    = new BABYLON.Vector3(1, 1, 1);
        this.tmp_quat     = new BABYLON.Quaternion();
        this.QuatIdentity = BABYLON.Quaternion.Identity();
        this.tmp_matrix   = new BABYLON.Matrix();

        this.create();
    }

    create() {
        this.mesh = BABYLON.MeshBuilder.CreatePolyhedron( "tetra", { type: 0, size: 1 }, this.scene);

        // 頂点データを取得、重心を計算し、原点を重心に重ねる
        const positions = this.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < positions.length; i += 3) {
            cx += positions[i];
            cy += positions[i + 1];
            cz += positions[i + 2];
        }
        cx /= positions.length / 3;
        cy /= positions.length / 3;
        cz /= positions.length / 3;
        // 平行移動行列を作成し、頂点を移動して bake
        BABYLON.Matrix.TranslationToRef(-cx, -cy, -cz, this.tmp_matrix);
        this.mesh.bakeTransformIntoVertices(this.tmp_matrix);

        const mat = new BABYLON.CustomMaterial("instancedMat", this.scene);
        mat.backFaceCulling = true;
        mat.alpha = 1.0;
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        mat.disableLighting = true;
        mat.Fragment_Before_FragColor(`color = vColor;`);

        this.mesh.material = mat;
        this.mesh.thinInstanceEnablePicking = false;

        for (let i = 0; i < MAX_REMAINS; i++) {
            this._writeMatrix(i, ZERO_SCALE, BABYLON.Vector3.Zero(), this.QuatIdentity);
        }
        this.mesh.thinInstanceSetBuffer("matrix", this.matrixBuffer, 16, false);
        this.mesh.thinInstanceSetBuffer("color",  this.colorBuffer,   4, false);
    }

    _writeMatrix(index, scale, position, rotation) {
        const quat = rotation ?? this.QuatIdentity;
        BABYLON.Matrix.ComposeToRef(
            scale,
            quat,
            position,
            this.tmp_matrix
        );
        this.tmp_matrix.copyToArray(this.matrixBuffer, index * 16);
    }

    _writeColor(index, color) {
        const cOffset = index * 4;
        this.colorBuffer[cOffset + 0] = color.r;
        this.colorBuffer[cOffset + 1] = color.g;
        this.colorBuffer[cOffset + 2] = color.b;
        this.colorBuffer[cOffset + 3] = color.a ?? ALPHA_START;
    }

    add_remain(pos, color, scale = 1) {
        const index = this.flags.findIndex(f => f === false);
        if (index === -1) {
            console.warn("No free remain slot");
            return;
        }

        this.flags[index] = true;

        // stats を初期化
        const st = this.stats[index];
        st.scale   = scale * SCALE_FACTOR;
        st.state   = ST_APPEARING;
        st.counter = 0;
        st.axis.set(0, 1, 0);  // axis はランダム（ST_MOVE 遷移時に改めて設定）

        // 位置を記録
        // ST_APPEARING 中はスケール 0 で表示するので位置だけ仮書き
        this._writeMatrix(index, ZERO_SCALE, pos, this.QuatIdentity);
        this._writeColor(index, color);

        // 位置を stats に保存しておく（update で使うため）
        st.position.copyFrom(pos);

        this.mesh.thinInstanceBufferUpdated("matrix");
        this.mesh.thinInstanceBufferUpdated("color");
    }

    // ランダムな単位ベクトルを生成して v に書き込む（球面一様分布）
    _randomAxisToRef(v) {
        // 球面一様サンプリング（Marsaglia 法）
        let x, y, z, len;
        do {
            x = Math.random() * 2 - 1;
            y = Math.random() * 2 - 1;
            z = Math.random() * 2 - 1;
            len = Math.sqrt(x * x + y * y + z * z);
        } while (len === 0 || len > 1);
        v.set(x / len, y / len, z / len);
    }

    update(time, delta) {
        let _matrixDirty = false;
        let _colorDirty  = false;
        for (let i = 0; i < MAX_REMAINS; i++) {
            if (!this.flags[i]) continue;

            const st = this.stats[i];

            switch (st.state) {

                case ST_APPEARING: {
                    st.counter += 1;
                    const progress = st.counter / ST_APPEARING_COUNT;
                    const displayScale = st.scale * Math.min(progress, 1);
                    this.tmp_scale.set(displayScale, displayScale, displayScale);
                    this._writeMatrix(i, this.tmp_scale, st.position, this.QuatIdentity);

                    if (st.counter >= ST_APPEARING_COUNT) {
                        st.state   = ST_TRANSPARENT;
                        st.counter = 0;
                        this._randomAxisToRef(st.axis);
                    }
                    _matrixDirty = true;
                    break;
                }

                case ST_TRANSPARENT: {
                    st.counter += 1;
                    const progress = st.counter / ST_TRANSPARENT_COUNT;
                    const alpha = ALPHA_START - (ALPHA_START - ALPHA_REMAINING) * progress;
                    const cOffset = i * 4;
                    this.colorBuffer[cOffset + 3] = alpha;

                    const angle = (Math.PI * 2) * progress;
                    BABYLON.Quaternion.RotationAxisToRef(st.axis, angle, this.tmp_quat);
                    const s = st.scale;
                    this.tmp_scale.set(s, s, s);
                    this._writeMatrix(i, this.tmp_scale, st.position, this.tmp_quat);

                    if (st.counter >= ST_TRANSPARENT_COUNT) {
                        st.state   = ST_MOVE;
                        st.counter = 0;

                    }
                    _colorDirty = true;
                    _matrixDirty = true;
                    break;
                }

                case ST_MOVE: {
                    st.position.y -= DOWN_SPEED  * delta;
                    st.position.z += DEPTH_SPEED * delta;
                    st.counter    += delta;

                    const angle = ROTATE_SPEED * st.counter;
                    BABYLON.Quaternion.RotationAxisToRef(st.axis, angle, this.tmp_quat);

                    const s = st.scale;
                    this.tmp_scale.set(s, s, s);
                    this._writeMatrix(i, this.tmp_scale, st.position, this.tmp_quat);

                    if (st.position.y < GLOBALS.GROUND.Y) {
                        st.state   = ST_REMAINING;
                        st.counter = 0;
                    }
                    _matrixDirty = true;
                    break;
                }

                case ST_REMAINING: {
                    st.counter += delta / 1000;
                    if (st.counter >= ST_REMAINING_PERIOD) {
                        st.state   = ST_DISAPPEARING;
                        st.counter = 0;
                    }
                    break;
                }

                case ST_DISAPPEARING: {
                    st.counter += 1;
                    const t = Math.min(st.counter / ST_DISAPPEARING_COUNT, 1);
                    const alpha = ALPHA_REMAINING * (1 - t);

                    // alpha だけ更新（色相・位置・スケールは維持）
                    const cOffset = i * 4;
                    this.colorBuffer[cOffset + 3] = alpha;

                    if (st.counter >= ST_DISAPPEARING_COUNT) {
                        this.flags[i] = false;
                        this._writeMatrix(i, ZERO_SCALE, ZERO_POSITION, this.QuatIdentity);
                        this.colorBuffer[cOffset + 3] = 0;
                    }
                    _colorDirty = true;
                    break;
                }
            }
        }

        if (_matrixDirty) this.mesh.thinInstanceBufferUpdated("matrix");
        if (_colorDirty) this.mesh.thinInstanceBufferUpdated("color");
    }

    dispose() {
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        this.matrixBuffer = null;
        this.colorBuffer  = null;
        this.flags        = null;
        this.stats        = null;
    }
}