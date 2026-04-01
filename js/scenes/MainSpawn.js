// MainSpawn.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';
import { Spirit } from "../objects/base_spirit.js";
import { Spirit_Fish } from "../objects/spirit_fish.js";
import { Spirit_Jelly } from "../objects/spirit_jelly.js";
import { Spirit_Plankton } from "../objects/spirit_plankton.js";
import { Spirit_Shark } from "../objects/spirit_shark.js";
import { Spirit_Whale } from "../objects/spirit_whale.js";
import { Spirit_Virus } from "../objects/spirit_virus.js";
import { Spirit_Squid } from "../objects/spirit_squid.js";
import { Effect_Extinction } from "../objects/effect_extinction.js";
import { Effect_Predation } from "../objects/effect_predation.js";
import { Effect_Feeding } from "../objects/effect_feeding.js";

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
            spirit_squid : [],
            effect_extinction : [],
            effect_predation : [],
            effect_feeding : []
        };

        this.ClassList = {
            'Spirit_Fish'       : {class : Spirit_Fish,         pool : this.pool.spirit_fish,        list:GameState.spirits}, 
            'Spirit_Jelly'      : {class : Spirit_Jelly,        pool : this.pool.spirit_jelly,       list:GameState.spirits},
            'Spirit_Plankton'   : {class : Spirit_Plankton,     pool : this.pool.spirit_plankton,    list:GameState.spirits},
            'Spirit_Shark'      : {class : Spirit_Shark,        pool : this.pool.spirit_shark,       list:GameState.spirits},
            'Spirit_Whale'      : {class : Spirit_Whale,        pool : this.pool.spirit_whale,       list:GameState.spirits},
            'Spirit_Virus'      : {class : Spirit_Virus,        pool : this.pool.spirit_virus,       list:GameState.spirits},
            'Spirit_Squid'      : {class : Spirit_Squid,        pool : this.pool.spirit_squid,       list:GameState.spirits},
            'Effect_Extinction' : {class : Effect_Extinction,   pool : this.pool.effect_extinction,  list:GameState.effects}, 
            'Effect_Predation'  : {class : Effect_Predation,    pool : this.pool.effect_predation,   list:GameState.effects},
            'Effect_Feeding'    : {class : Effect_Feeding,      pool : this.pool.effect_feeding,     list:GameState.effects}
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
            Spirit.setupDepthCloneRenderOrder(this.scene); //半透明ボディ用 depthClone の処理順強制変更
            // console.log("[SPAWN] activate NEW:",class_name, " - ", type_name, " length:", pool.length, list.length);
        }
        object.activate(pos, params);
        list.push(object);
/*
        for (let i = 0; i < list.length; i++){
            if (list[i].class_name !== "Spirit_Plankton" && list[i].class_name !== "Spirit_Virus" && list[i].isCollidable === false){
               console.log("list:",i, list[i].isCollidable, list[i].collision_disabled_timer, list[i].class_name);
            }
        }
 */
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
} // End of Spawn

export class SpawnScheduler {
    constructor(){
        this.max_plankton = 80;
        this.period_plankton = 1000;
        this.count_plankton = this.period_plankton;

        this.max_virus = 30;
        this.period_virus = 1130;
        this.count_virus = this.period_virus;

        this.max_fish = 50;
        this.period_fish = 3000;
        this.count_fish = this.period_fish;

        this.max_jelly = 20;
        this.period_jelly = 13500;
        this.count_jelly = this.period_jelly;

        this.max_squid = 10;
        this.period_squid = 31000;
        this.count_squid = this.period_squid;

        this.max_shark = 3;
        this.period_shark = 81900;
        this.count_shark = this.period_shark;

        this.max_whale = 2;
        this.period_whale = 198000;
        this.count_whale = this.period_whale;
    }

    random_surface_position(radius){
        const u = Math.random();
        const v = Math.random();

        const theta = Math.acos(2 * u - 1); // 0〜π
        const phi = 2 * Math.PI * v;        // 0〜2π

        const x = Math.sin(theta) * Math.cos(phi);
        const y = Math.sin(theta) * Math.sin(phi);
        const z = Math.cos(theta);

        return new BABYLON.Vector3(x, y, z).scale(radius);
    }

    initial_placement(){    
        for(let i=0; i<10; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate("Spirit_Plankton", i, pos);
        }
        for(let i=0; i<2; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate("Spirit_Shark", i, pos);
        }
        for(let i=0; i<10; i++){
            const pos = this.random_surface_position(5.0);
            GameState.spawn.activate("Spirit_Fish", i, pos);
        }
        for(let i=0; i<5; i++){
            const pos = this.random_surface_position(3.0);
            GameState.spawn.activate("Spirit_Jelly", i, pos);
        }
        for(let i=0; i<1; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate("Spirit_Whale", i, pos);
        }
        for(let i=0; i<1; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate("Spirit_Squid", i, pos);
        }
    }

    count_class(class_name) {
        return GameState.spirits.filter(s => s.class_name === class_name).length;
    }

    update(time, delta){
        if (!GameState.spawn) return;

        this.count_plankton -= delta;
        if (this.count_plankton < 0){
            this.count_plankton = this.period_plankton;
            if (this.count_class("Spirit_Plankton") < this.max_plankton){
                const pos = this.random_surface_position(20.0);
                GameState.spawn.activate("Spirit_Plankton", 0, pos);
            }
        }

        this.count_virus -= delta;
        if (this.count_virus < 0){
            this.count_virus = this.period_virus;
            if (this.count_class("Spirit_Virus") < this.max_virus){
                const pos = this.random_surface_position(20.0);
                GameState.spawn.activate("Spirit_Virus", 0, pos);
            }
        }

        this.count_fish -= delta;
        if (this.count_fish < 0){
            this.count_fish = this.period_fish;
            if (this.count_class("Spirit_Fish") < this.max_fish){
                const pos = this.random_surface_position(20.0);
                GameState.spawn.activate("Spirit_Fish", "SPEED", pos, {speed : 2.0});
            }
        }

        this.count_jelly -= delta;
        if (this.count_jelly < 0){
            this.count_jelly = this.period_jelly;
            if (this.count_class("Spirit_Jelly") < this.max_jelly){
                const pos = this.random_surface_position(20.0);
                GameState.spawn.activate("Spirit_Jelly", 0, pos);
            }
        }

        this.count_squid -= delta;
        if (this.count_squid < 0){
            this.count_squid = this.period_squid;
            if (this.count_class("Spirit_Squid") < this.max_squid){
                const pos = this.random_surface_position(20.0);
                GameState.spawn.activate("Spirit_Squid", 0, pos);
            }
        }

        this.count_shark -= delta;
        if (this.count_shark < 0){
            this.count_shark = this.period_shark;
            if (this.count_class("Spirit_Shark") < this.max_shark){
                const pos = this.random_surface_position(20.0);
                GameState.spawn.activate("Spirit_Shark", "SPEED", pos, {speed : 2.0, accel : 2.0,
//                    predation_radius : 2.0, predation_classes : ["Spirit_Fish", "Spirit_Jelly"]});
                    predation_radius : 2.0});
                }
        }

        this.count_whale -= delta;
        if (this.count_whale < 0){
            this.count_whale = this.period_whale;
            if (this.count_class("Spirit_Whale") < this.max_whale){
                const pos = this.random_surface_position(20.0);
                GameState.spawn.activate("Spirit_Whale", 0, pos);
            }
        }        
    }

    dispose(){
    }

} // End of SpawnScheduler