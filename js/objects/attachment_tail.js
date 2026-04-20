// attachment_tail.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

export class Attachment_Tail extends Attachment{

    constructor(spirit, socket, parameters = {}){
        super(spirit, socket);

        const { position: tp, normal: tn } = socket;
        const { scale = 1.0 , twist = false, speed = 7.0, offset = 0.0, material_key = null} = parameters;
        this.normal = tn;

        const positions = [
            0,0,0,
            0,-0.4,0.8,
            0,+0.4,0.8
        ];
        const indices = [0,1,2];
        const tail = new BABYLON.Mesh("tail", this.scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.applyToMesh(tail);

        const mat = this.spirit.shared_materials.get(material_key);
        mat.backFaceCulling = false;
        tail.material = mat;

        tail._wagPhase = Math.random() * Math.PI * 2; // 個体差
        tail._wagSpeed = speed;   // 周波数
        tail._wagAmp   = 0.4;   // 振れ幅（ラジアン）

        tail.position.copyFrom(tp);
        this.shift_position(tail.position, this.normal, offset);

        this.qRoll = twist
            ? BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2)
            : BABYLON.Quaternion.Identity();
        tail.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionLH(
            this.normal,
            BABYLON.Axis.Y
        ).multiply(this.qRoll);

        tail.parent = this.parent;

        tail.scaling = new BABYLON.Vector3(scale, scale, scale);
        this.mesh = tail;
        this.nodes.push(tail);
        this.spirit.register_child_node(tail);

        // テンポラリ変数
        this.tmp_qSwing      = new BABYLON.Quaternion();
        this.tmp_qBase       = new BABYLON.Quaternion();
        this.tmp_qRolled     = new BABYLON.Quaternion();
        this.tmp_qFinal      = new BABYLON.Quaternion();
    }

    update(time, delta){
        const t = time * 0.001; // 秒
        const angle = this.mesh._wagAmp * Math.sin(t * this.mesh._wagSpeed + this.mesh._wagPhase);

        // 尻尾のローカル回転
        BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Y, angle, this.tmp_qSwing);
        // ソケットの向き（localNormal）を向く回転
        BABYLON.Quaternion.FromLookDirectionLHToRef(this.normal, BABYLON.Axis.Y, this.tmp_qBase);
        // 合成：まずソケット方向へ向け、そこから左右に振る
        this.tmp_qBase.multiplyToRef(this.qRoll, this.tmp_qRolled);
        this.tmp_qRolled.multiplyToRef(this.tmp_qSwing, this.tmp_qFinal);
        this.mesh.rotationQuaternion.copyFrom(this.tmp_qFinal);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}