// attachment_spine.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

const DEFAULT_COLOR = new BABYLON.Color3(0.0, 1.0, 0.0);

export class Attachment_Spine extends Attachment{

    constructor(spirit, socket, parameters = {}){
        super(spirit, socket);

        const { position: sp1p, normal: sp1n } = socket;
        const { diameterBottom=0.2, height=0.45, alpha=1.0, color=DEFAULT_COLOR} = parameters;

        const mesh = BABYLON.MeshBuilder.CreateCylinder("spine", {
            diameterTop: 0.0, diameterBottom: diameterBottom, height: height, tessellation: 8
        }, this.scene);
        mesh.checkCollisions = false;
        mesh.isPickable = false;

        const yAxis = sp1n.scale(-1);
        const up = Math.abs(BABYLON.Vector3.Dot(yAxis, BABYLON.Axis.Y)) < 0.99
            ? BABYLON.Axis.Y
            : BABYLON.Axis.X;
        const zAxis = BABYLON.Vector3.Cross(yAxis, up).normalize();
        const xAxis = BABYLON.Vector3.Cross(yAxis, zAxis).normalize();

        mesh.rotationQuaternion = BABYLON.Quaternion.RotationQuaternionFromAxis(
            xAxis, yAxis, zAxis
        );

        // 底面(Y-)がsp1n方向なので、中心をsp1nへ -height/2 オフセット
        mesh.position = sp1p.add(sp1n.scale(-height / 2));

        const mat = new BABYLON.PBRMaterial("spineMat", this.scene);
        mat.albedoColor = color;
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = alpha;
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