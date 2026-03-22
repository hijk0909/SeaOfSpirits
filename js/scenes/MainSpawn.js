// MainSpawn.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';
import { MyMath } from "../utils/MathUtils.js";
import { Spirit_Fish } from "../objects/spirit_fish.js";
import { Spirit_Jelly } from "../objects/spirit_jelly.js";
import { Spirit_Plankton } from "../objects/spirit_plankton.js";
import { Spirit_Shark } from "../objects/spirit_shark.js";
import { Spirit_Whale } from "../objects/spirit_whale.js";
import { Spirit_Virus } from "../objects/spirit_virus.js";
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
            spirit_virus : [],
            effect_extinction : [],
            effect_predation : []
        };

        this.ClassList = {
            'Spirit_Fish'       : {class : Spirit_Fish,         pool : this.pool.spirit_fish,        list:GameState.spirits}, 
            'Spirit_Jelly'      : {class : Spirit_Jelly,        pool : this.pool.spirit_jelly,       list:GameState.spirits},
            'Spirit_Plankton'   : {class : Spirit_Plankton,     pool : this.pool.spirit_plankton,    list:GameState.spirits},
            'Spirit_Shark'      : {class : Spirit_Shark,        pool : this.pool.spirit_shark,       list:GameState.spirits},
            'Spirit_Whale'      : {class : Spirit_Whale,        pool : this.pool.spirit_whale,       list:GameState.spirits},
            'Spirit_Virus'      : {class : Spirit_Virus,        pool : this.pool.spirit_virus,       list:GameState.spirits},
            'Effect_Extinction' : {class : Effect_Extinction,   pool : this.pool.effect_extinction,  list:GameState.effects}, 
            'Effect_Predation'  : {class : Effect_Predation,    pool : this.pool.effect_predation,   list:GameState.effects}
        }
    }

    activate(class_name, type_name, pos, params = null){
        const {class : Class, pool : pool, list : list} = this.ClassList[class_name];

        let object;
        const index = pool.findIndex(obj => obj.type_name === type_name);
        if ( index !== -1 ){
            object = pool.splice(index, 1)[0];
            // console.log("[SPAWN] activate REUSE:",class_name, " - ", type_name, " length:", pool.length, list.length);
        } else {
            object = new Class(this.scene, class_name, type_name);
            object.create(params);
            // console.log("[SPAWN] activate NEW:",class_name, " - ", type_name, " length:", pool.length, list.length);
        }
        object.activate(pos, params);
        list.push(object);
        return object;
    }

    deactivate(object){
        object.deactivate();
        const class_name = object.class_name;
        const {pool : pool} = this.ClassList[class_name];
        pool.push(object);
        // console.log("[SPAWN] deactivate:", class_name, pool.length);
    }

    dispose(){
        // 稼働中のオブジェクトの破棄
        for (let i = GameState.spirits.length - 1; i >= 0; i--) {
            GameState.spirits[i].dispose();
            GameState.spirits.splice(i, 1);
        }
        GameState.spirits = [];

        // プールのオブジェクトの破棄
        for (const key in this.pool) {
            for (const obj of this.pool[key]) {
                obj.dispose();
            }
        }

    } // End of dispose
}