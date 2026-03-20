// attachment_tail.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

export class Attachment_Tail extends Attachment{

    constructor(spirit, socket, parameters = {}){
        super(spirit, socket);

        const { position: tp, normal: tn } = socket;
        const { scale = 1.0 , twist = false, alpha = 1.0} = parameters;
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

        const mat = new BABYLON.PBRMaterial("tailMat", this.scene);
        mat.albedoColor = new BABYLON.Color3(1, 0.0, 0.0);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = alpha;
        mat.backFaceCulling = false;
        tail.material = mat;

        tail._wagPhase = Math.random() * Math.PI * 2; // 個体差
        tail._wagSpeed = 7.0;   // 周波数
        tail._wagAmp   = 0.4;   // 振れ幅（ラジアン）

        tail.position.copyFrom(tp);
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
    }

    update(time, delta){
        const t = time * 0.001; // 秒
        const angle = this.mesh._wagAmp * Math.sin(t * this.mesh._wagSpeed + this.mesh._wagPhase);
        // 尻尾のローカル回転
        const qSwing = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, angle)
        // ソケットの向き（localNormal）を向く回転
        const qBase = BABYLON.Quaternion.FromLookDirectionLH(
            this.normal, BABYLON.Axis.Y
        ).multiply(this.qRoll);
        // 合成：まずソケット方向へ向け、そこから左右に振る
        this.mesh.rotationQuaternion = qBase.multiply(qSwing);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}