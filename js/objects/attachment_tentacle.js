// attachment_tentacle.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

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