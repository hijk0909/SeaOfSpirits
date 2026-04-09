// attachment_fin.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

export class Attachment_Fin extends Attachment{

    constructor(spirit, socket, parameters){
        super(spirit, socket);

        const { position: fp, normal: fn } = socket;
        const { bottomScale=1.0, height=1.0, twist=0.0, offset = 0.0, material_key = null} = parameters;

        // 頂点座標
        const positions = [
            [-0.05, -0.4, 0],   // 0: bottom A
            [+0.05, -0.4, 0],   // 1: bottom B
            [ 0.0,  0.4,  0],   // 2: bottom C
            [ 0.0,  0.0, +0.7]  // 3: top apex
        ];

        // 面（頂点インデックスの配列）
        const faces = [
            [0, 1, 2],  // 底面
            [0, 1, 3],  // 側面1
            [1, 2, 3],  // 側面2
            [2, 0, 3]   // 側面3
        ];

        const mesh = BABYLON.MeshBuilder.CreatePolyhedron("fin", {
            custom: { vertex: positions, face: faces }
            }, this.scene);

        mesh.position.copyFrom(fp);
        this.shift_position(mesh.position, fn, offset);
        mesh.scaling = new BABYLON.Vector3(bottomScale, bottomScale, height);

        // （１）Z軸周りに twist度回転させるクオータニオン
        const qTwist = BABYLON.Quaternion.RotationAxis(
            BABYLON.Axis.Z,
            BABYLON.Tools.ToRadians(twist)
        );

        // （２）Z軸を法線方向に合わせるクオータニオン
        const zAxis = fn.scale(-1);
        // 参照ベクトル ref を決める（zAxisと平行でない適当なベクトル）
        const ref = (Math.abs(zAxis.y) < 0.99)
            ? BABYLON.Axis.Y   // 通常はY軸を基準に
            : BABYLON.Axis.X;  // zAxisがY軸に近いときはX軸を使う
        const xAxis = BABYLON.Vector3.Cross(ref, zAxis).normalize();
        const yAxis = BABYLON.Vector3.Cross(zAxis, xAxis).normalize();
        const qAlign = BABYLON.Quaternion.RotationQuaternionFromAxis(xAxis, yAxis, zAxis);

        // （３）合成クオータニオンを代入
        mesh.rotationQuaternion = qAlign.multiply(qTwist);

        const mat = this.spirit.shared_materials.get(material_key);
        mat.backFaceCulling = false;
        mesh.material = mat;

        mesh.parent = this.parent;
        this.nodes.push(mesh);
    }

    update(time, delta){
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}