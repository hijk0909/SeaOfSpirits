// player.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Drawable } from "./base_drawable.js";
import { MyMath } from '../utils/MathUtils.js';

export class Player extends Drawable{
    constructor(scene, cls){
        super(scene, cls);
        this.prev_mouse_button = false;

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
        mat.alpha = 0.5;
        this.mesh.material = mat;

        this.light = new BABYLON.PointLight("pointLight", this.root.position, this.scene);
        this.light.intensity = 80;
        this.light.range = 30;
        this.light.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
        this.light.setEnabled(false); 
    }

    update(time, delta){
        // console.log(this.prev_mouse_button, GameState.inputMouse.button);
        if (GameState.inputMouse.button){
            if (!this.prev_mouse_button){
                this.set_intervention();
            }
            this.intervention_to_environment();
        } else if (this.prev_mouse_button){
            this.reset_intervention();
        }
        this.prev_mouse_button = GameState.inputMouse.button;
    }

    get_environment_velocity(pos){
        let ev = new BABYLON.Vector3(0,0,0);
        if (this.intervention === true){
            const diff = pos.subtract(this.root.position);
            const dist = diff.length();
            if (dist > 2.0){
                ev = diff.normalize().scale(-0.1/dist);
                // console.log("ev:", ev.length());
            }
        }
        return ev;
    }

    intervention_to_environment(){
        const world_pos = MyMath.mouse_to_world(GameState.inputMouse.x , GameState.inputMouse.y, 0);
        // console.log("mouse_up:", world_pos, GameState.inputMouse.x, GameState.inputMouse.y);
        this.root.position = world_pos.clone();
        this.light.position = world_pos.clone();
    }

    set_intervention(){
        this.mesh.material.albedoColor.set(1.0, 1.0, 0.0);
        this.mesh.material.emissiveColor.set(3.0, 3.0, 0.0);
        this.light.setEnabled(true); 
        this.intervention = true;
    }

    reset_intervention(){
        this.mesh.material.albedoColor.set(0.3, 0.3, 0.0);
        this.mesh.material.emissiveColor.set(0.5, 0.5, 0);
        this.light.setEnabled(false); 
        this.intervention = false;
    }
}