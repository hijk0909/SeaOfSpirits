// base_drawable.js
export class Drawable {

    constructor(scene, class_name = ""){
        this.scene = scene;
        this.class_name = class_name;
        this.root = new BABYLON.TransformNode("Root");
        this.mesh = null;
        this.alive = true;
        this.id = 0;
    }

    create(){
    }

    update(){
    }

    isAlive(){
        return this.alive;
    }

    activate(){
        this.alive = true;
    }

    deactivate(){
        this.alive = false;
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