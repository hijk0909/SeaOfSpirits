// attachment_eye.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

const DEFAULT_COLOR = new BABYLON.Color3(0.4, 0.8, 1.0);
const DEFAULT_EMISSIVE = new BABYLON.Color3(0.4, 0.8, 1.0);

export class Attachment_Eye extends Attachment{

    constructor(spirit, socket, parameters){
        super(spirit, socket);

        const { position: ep, normal: en } = socket;
        const { scale = 1.0, alpha = 1.0, color = DEFAULT_COLOR, emissive = DEFAULT_EMISSIVE} = parameters;

        const mesh = BABYLON.MeshBuilder.CreateSphere( "eye", { diameter: 0.2 * scale, segments: 16}, this.scene );
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        mesh.position.copyFrom(ep);
        mesh.parent = this.parent;

        const mat = new BABYLON.PBRMaterial("eyeMat", this.scene);
        mat.albedoColor = color;
        mat.emissiveColor =  emissive;
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = alpha;
        mesh.material = mat;

        mesh.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionLH(
            en,                   // forward（= +Z を向けたい方向）
            BABYLON.Axis.Y        // up（できるだけ Y を上に保つ）
        );
        this.nodes.push(mesh);
    }

    update(time, delta){
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}