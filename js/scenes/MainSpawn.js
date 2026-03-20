// MainSpawn.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';
import { MyMath } from "../utils/MathUtils.js";
import { Spirit_Fish } from "../objects/spirit_fish.js";
import { Spirit_Jelly } from "../objects/spirit_jelly.js";
import { Spirit_Plankton } from "../objects/spirit_plankton.js";
import { Spirit_Shark } from "../objects/spirit_shark.js";
import { Spirit_Whale } from "../objects/spirit_whale.js";
import { Effect_Extinction } from "../objects/effect_extinction.js";
import { Effect_Predation } from "../objects/effect_predation.js";

export class Spawn {
    constructor(scene) {
        this.scene = scene;

        this.pool = {
            spirit_fish : [],
            spirit_jelly : [],
            spirit_plankton : [],
            spirit_shark : [],
            spirit_whale : [],
            effect_extinction : [],
            effect_predation : []
        }

        this.ClassList = {
            'Spirit_Fish'       : {class : Spirit_Fish,         pool : this.pool.spirit_fish,        list:GameState.spirits}, 
            'Spirit_Jelly'      : {class : Spirit_Jelly,        pool : this.pool.spirit_jelly,       list:GameState.spirits},
            'Spirit_Plankton'   : {class : Spirit_Plankton,     pool : this.pool.spirit_plankton,    list:GameState.spirits},
            'Spirit_Shark'      : {class : Spirit_Shark,        pool : this.pool.spirit_shark,       list:GameState.spirits},
            'Spirit_Whale'      : {class : Spirit_Whale,        pool : this.pool.spirit_whale,       list:GameState.spirits},
            'Effect_Extinction' : {class : Effect_Extinction,   pool : this.pool.effect_extinction,  list:GameState.effects}, 
            'Effect_Predation'  : {class : Effect_Predation,    pool : this.pool.effect_predation,   list:GameState.effects}
        }
    }

    activate(class_name, id, pos, type=""){
        const {class : Class, pool : pool, list : list} = this.ClassList[class_name];
        let object;
        if (pool.length > 0){
            object = pool.pop();
            // console.log("activate reuse:",class_name, pool.length);
        } else {
            object = new Class(this.scene, class_name, id);
            object.create(type);
            // console.log("activate new:",class_name);
        }
        object.activate(pos);
        list.push(object);
        return object;
    }

    deactivate(object){
        object.deactivate();
        const class_name = object.class_name;
        const {pool : pool} = this.ClassList[class_name];
        pool.push(object);
        // console.log("deactivate:", class_name, pool.length);
    }

    dispose(){
        // 稼働中のオブジェクト
        for (let i = GameState.spirits.length - 1; i >= 0; i--) {
            GameState.spirits[i].dispose();
            GameState.spirits.splice(i, 1);
        }
        GameState.spirits = [];

        // プールのオブジェクト
        for (const group of [this.mesh, this.texture, this.sprite, this.container, this.bgm, this.se, this.jingle, this.data, this.image]) {
            for (const key in group){
                const object = group[key];
                if (object){
                    // console.log("dispose.object:", object);
                    object.dispose();
                    group[key] = null;
                }
            }
        }
        

    } // End of dispose
}