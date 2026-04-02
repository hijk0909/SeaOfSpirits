// base_effect.js
import { Drawable } from "./base_drawable.js";

export class Effect extends Drawable {

    constructor(scene, class_name){
        super(scene, class_name);
    }

    activate(pos, params){
        super.activate(pos, params);
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