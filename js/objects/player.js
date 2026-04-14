// player.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Drawable } from "./base_drawable.js";
import { MyMath } from '../utils/MathUtils.js';

const FEED_PERIOD = 0.2; //プランクトン生成間隔
const SPAWN_PLANKTON_IMPULSE = 0.06; //プランクトンを吹き出す強さ
const CLEAN_PERIOD = 1.1; //ウィルス掃除間隔
const GRAVITY = 0.1; //引力
const MIN_DIST = 2.0; //引力を及ぼす範囲
const CLEAN_RADIUS = 2.1; //ウィルスを焼く範囲

export class Player extends Drawable{
    constructor(scene, cls){
        super(scene, cls);
        this.prev_mouse_button = false;

        this.feed_counter = 0;
        this.clean_counter = 0;

        this.tmp_environmentVelocity = new BABYLON.Vector3();
        this.tmp_worldPos = new BABYLON.Vector3();

        this.create();
    }

    create(){
        this.root.position = new BABYLON.Vector3(0,0,0);

        this.mesh = BABYLON.MeshBuilder.CreateSphere( "player", { diameter: 1.0, segments: 16 }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;
        this.mesh.setEnabled(true);

        const mat = new BABYLON.PBRMaterial("player_material", this.scene); 
        mat.albedoColor = new BABYLON.Color3(0.3, 0.3, 0);
        mat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = 0.1;
        this.mesh.material = mat;

        this.light = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(0,0,0), this.scene);
        this.light.intensity = 80;
        this.light.range = 30;
        this.light.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
        this.light.setEnabled(false); 

        // MyMath.setScreenToWorldParameters(); // MyMath.mouseToWorldToRef を呼ぶ前に実行必要
    }

    update(time, delta){
        // console.log(this.prev_mouse_button, GameState.inputMouse.button);
        if (GameState.inputMouse.button){
            if (!this.prev_mouse_button){
                this.activate_player();
                MyMath.setScreenToWorldParameters(); // MyMath.mouseToWorldToRef を呼ぶ前に実行必要
            }
            this.update_position();
            this.spawn_plankton(delta);
            this.clean_virus(delta);
        } else if (this.prev_mouse_button){
            this.deactivate_player();
        }
        this.prev_mouse_button = GameState.inputMouse.button;
    }


    update_position(){
        MyMath.mouseToWorldToRef(GameState.inputMouse.x , GameState.inputMouse.y, 0, this.tmp_worldPos);
        this.root.position.copyFrom(this.tmp_worldPos);
        this.light.position.copyFrom(this.tmp_worldPos);
    }

    spawn_plankton(delta){ 
        this.feed_counter += delta / 1000;
        if (this.feed_counter > FEED_PERIOD){
            this.feed_counter = 0;

            const st = GameState.spawn.spirit_class_state["Spirit_Plankton"];
            const plankton = GameState.spawn.activate_spirit("Spirit_Plankton", this.root.position, st.generation);

            const theta = Math.acos(2 * Math.random() - 1); // 0〜π
            const phi = 2 * Math.PI * Math.random();        // 0〜2π
            const x = Math.sin(theta) * Math.cos(phi);
            const y = Math.sin(theta) * Math.sin(phi);
            const z = Math.cos(theta);

            const impuls = new BABYLON.Vector3(x, y, z).scale(SPAWN_PLANKTON_IMPULSE);
            plankton.add_impulse(impuls);
        }
    }

    clean_virus(delta){
        this.clean_counter += delta / 1000;
        if (this.clean_counter > CLEAN_PERIOD){
            this.clean_counter = 0;
            for (let sp of GameState.spirits){
                if (sp.class_name === "Spirit_Virus"){
                    if (BABYLON.Vector3.DistanceSquared(sp.root.position, this.root.position) < CLEAN_RADIUS * CLEAN_RADIUS){
                        sp.dying = true;
                        GameState.spawn.activate_effect("Effect_Extinction", sp.root.position, { size : sp.collisionRadius});
                        GameState.remains.add_remain(sp.root.position, sp.remain_color, sp.collisionRadius);
                        GameState.asset.se.extinction.play_3D(sp.root.position);
                    }
                }
            }
        }
    }

    EnvironmentVelocityToRef(pos, velocity){
        if (this.intervention === true){
            this.tmp_environmentVelocity.copyFrom(pos);
            this.tmp_environmentVelocity.subtractToRef(this.root.position, this.tmp_environmentVelocity);
            const distSq = this.tmp_environmentVelocity.lengthSquared();
            if (distSq > MIN_DIST * MIN_DIST){
                this.tmp_environmentVelocity.normalize();
                // this.tmp_environmentVelocity.scaleInPlace(-GRAVITY/Math.sqrt(distSq));
                this.tmp_environmentVelocity.scaleInPlace(-GRAVITY);
                velocity.copyFrom(this.tmp_environmentVelocity);
            } else {
                velocity.copyFromFloats(0.0, 0.0, 0.0);
            }
        } else {
            velocity.copyFromFloats(0.0, 0.0, 0.0);
        }
    }

    activate_player(){
        this.mesh.material.albedoColor.set(1.0, 1.0, 0.0);
        this.mesh.material.emissiveColor.set(3.0, 3.0, 0.0);
        this.mesh.material.alpha = 0.5;
        this.light.setEnabled(true); 
        this.intervention = true;
    }

    deactivate_player(){
        this.mesh.material.albedoColor.set(0.3, 0.3, 0.0);
        this.mesh.material.emissiveColor.set(0.1, 0.1, 0);
        this.mesh.material.alpha = 0.1;
        this.light.setEnabled(false); 
        this.intervention = false;
    }
}