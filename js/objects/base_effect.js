// base_effect.js
import { Drawable } from "./base_drawable.js";

export class Effect extends Drawable {

    constructor(scene, class_name){
        super(scene, class_name);
    }

    create(mesh){
        super.create();
    }

    activate(){
        super.activate();
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}