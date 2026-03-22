// base_drawable.js

const DYING_TIME = 2.0; //秒

export class Drawable {

    constructor(scene, class_name = "", type_name = ""){
        this.scene = scene;
        this.class_name = class_name;
        this.type_name = type_name;
        this.root = new BABYLON.TransformNode("Root");
        this.mesh = null;
        this.alive = true;
        this.dying = false;
        this.dying_count = DYING_TIME;
        this.dying_ratio = 1.0;  // 1.0 → 0.0
    }

    create(params){
        this.params = params;
    }

    isAlive(){
        return this.alive;
    }

    set_dying(){
        this.dying = true;
        this.dying_count = DYING_TIME;
    }

    activate(pos, params){
        this.params = params;
        this.alive = true;
        this.dying = false;
    }

    deactivate(){
        this.alive = false;
    }

    update(time, delta){
        if (this.dying){
            this.dying_count -= delta / 1000;
            this.dying_ratio = this.dying_count / DYING_TIME;
            if (this.dying_count < 0){
                this.alive = false;
            }
        }
    }

    dispose(){
        if (this.mesh){
            this.mesh.dispose();
            this.mesh = null;
        }
        if (this.root){
            this.root.dispose();
            this.root
        }
    }
}