// base_spirit.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Collidable } from "./base_collidable.js";
import { MyMath } from "../utils/MathUtils.js";
import { MyDraw } from "../utils/DrawUtils.js";

const FLASH_TIME = 0.15; //秒
const LOD_THRESHOLD = 9.0;

const StateColor = {
    NONE : new BABYLON.Color3(0.0, 0.0, 0.0)
}

export class Spirit extends Collidable {

    constructor(scene, class_name, id){
        super(scene, class_name);

        this.attachments = [];
        this.id = id;

        this.emissive_materials = [];
        this.base_emissive_color = StateColor.NONE;
        this.flash_time = 0;

        this.hp_max = 100;
        this.hp = this.hp_max;
        this.hp_decrease = 0.1;

        this.predation_socket = null;
        this.predation_position = new BABYLON.Vector3();
        this.predation_radius = 0.2;
        this.predation_tribes = [];

        this.prev_LOD = false;

        // [DEBUG] 当たり判定の可視化
        this.debugEllipsoid = null;
    }

    create(){
        // emmisiveColor のある 全マテリアルの収集
        this.root.getChildMeshes().forEach(m => {
            if (m.material){
                m.material = m.material.clone();
                if (m.material.emissiveColor){
                    this.emissive_materials.push(m.material);
                }
            }
        });
        
        super.create();
    }

    activate(pos){
        this.root.setEnabled(true);
        this.root.position.copyFrom(pos);
        this.hp = this.hp_max;
        super.activate();
    }

    deactivate(){
        this.root.setEnabled(false);
        super.deactivate();
    }

    // デバッグ用のellipsoid可視化
    create_debug_ellipsoid(ellipsoid){
        this.debugEllipsoid = BABYLON.MeshBuilder.CreateSphere("debugEllipsoid", {
            diameterX: ellipsoid.x * 2,
            diameterY: ellipsoid.y * 2,
            diameterZ: ellipsoid.z * 2
        }, this.scene);

        this.debugEllipsoid.material = new BABYLON.StandardMaterial("debugMat", this.scene);
        this.debugEllipsoid.material.wireframe = true;
        this.debugEllipsoid.material.emissiveColor = new BABYLON.Color3(1, 0, 0);

        // 毎フレーム追従
        this.scene.registerBeforeRender(() => {
            if (this.mesh && this.debugEllipsoid){
                this.debugEllipsoid.position = this.collider.position.add(this.collider.ellipsoidOffset || BABYLON.Vector3.Zero());
            }
        });
    }

    flash(){
        this.flash_time = FLASH_TIME;
    }

    set_emissive_color(ec, t=0){
        if (ec){
            this.base_emissive_color = ec;
        }
        this.emissive_materials.forEach(mat => {
            mat.emissiveColor.set(this.base_emissive_color.r + t, this.base_emissive_color.g + t, this.base_emissive_color.b + t);
        });
    }

    get_socket(body_mesh, front, thetaDeg, phiDeg){
        const forward = new BABYLON.Vector3(0, 0, 1);
        const origin = body_mesh.getAbsolutePosition().add(forward.scale(front));

        const theta = BABYLON.Tools.ToRadians(thetaDeg); // 緯度
        const phi   = BABYLON.Tools.ToRadians(phiDeg);   // 経度
        const x = Math.cos(theta) * Math.sin(phi);
        const y = Math.sin(theta);
        const z = Math.cos(theta) * Math.cos(phi);
        const direction = new BABYLON.Vector3(x, y, z).normalize();

        const ray = new BABYLON.Ray(origin, direction, 10); // 10 は十分大きい距離
        const hit = this.scene.pickWithRay(ray, mesh => mesh === body_mesh);
        if (hit.hit) {
            const worldSocketPosition = hit.pickedPoint;
            const worldSocketNormal = hit.getNormal(true);
            const inv = body_mesh.getWorldMatrix().clone().invert();
            const localSocketPosition = BABYLON.Vector3.TransformCoordinates(worldSocketPosition, inv);
            const localSocketNormal = BABYLON.Vector3.TransformNormal(worldSocketNormal, inv);
            return { position: localSocketPosition, normal: localSocketNormal };
        } else {
            return null; // z が外側だったなど
        }
    }

    update(time, delta){
        // 空腹化
        this.hp -= this.hp_decrease;
        if (this.hp < 0){
            this.alive = false;
            // console.log("starvation:", this.class_name);
            GameState.spawn.activate("Effect_Extinction", 0, this.root.position);
        }

        // 環境流の計算
        this.environment_velocity = GameState.player.get_environment_velocity(this.root.position);

        // 捕食座標の更新
        if (this.predation_socket){
            // ソケット位置を親（this.mesh） のワールド行列でワールド空間に変換
            const worldMatrix = this.mesh.getWorldMatrix();
            this.predation_position = BABYLON.Vector3.TransformCoordinates(
                this.predation_socket.position,
                worldMatrix
            );
        }

        // emissive color の表示更新
        if (this.flash_time > 0) {
            this.flash_time -= delta / 1000;
            const t = Math.max(0, this.flash_time / FLASH_TIME); // 1→0
            this.set_emissive_color(null, t);
        }

        // LOD（表示詳細度の制御）
        if (this.prev_LOD){
            if (this.root.position.z < LOD_THRESHOLD){
                this.prev_LOD = false;
                for (const attachment of this.attachments) attachment.setEnabled(true);
            }
        } else {
            if (this.root.position.z > LOD_THRESHOLD){
                this.prev_LOD = true;
                for (const attachment of this.attachments) attachment.setEnabled(false);
            }
        }
        if (!this.prev_LOD){
            for (const attachment of this.attachments){
                attachment.update(time, delta);
            }
        }

        super.update(time, delta);
    }

    dispose(){

        if (this.debugEllipsoid){
            this.debugEllipsoid.dispose();
            this.debugEllipsoid = null;
        }

        for (const attachment of this.attachments){
            attachment.dispose();
        }

        super.dispose();
    }

} // End of Spirit