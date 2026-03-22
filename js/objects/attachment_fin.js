// attachment_fin.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

const DEFAULT_COLOR = new BABYLON.Color3(0.8, 1.0, 0.0);

export class Attachment_Fin extends Attachment{

    constructor(spirit, socket, parameters){
        super(spirit, socket);

        const { position: fp, normal: fn } = socket;
        const { bottomScale=1.0, height=1.0, alpha=1.0, color=DEFAULT_COLOR} = parameters;

        // 頂点座標
        const positions = [
            [-0.05, -0.4, 0],   // 0: bottom A
            [+0.05, -0.4, 0],   // 1: bottom B
            [ 0.0,  +0.4,  0],   // 2: bottom C
            [ 0.0,   0.0, +0.7]  // 3: top apex
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
        mesh.scaling = new BABYLON.Vector3(bottomScale, bottomScale, height);
        mesh.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionLH(
            fn,
            BABYLON.Axis.Z
        );

        const mat = new BABYLON.PBRMaterial("finMat", this.scene);
        mat.albedoColor = color;
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = alpha;
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