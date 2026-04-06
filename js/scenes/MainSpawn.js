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

        this.spirit_pools = {
            fish : [],
            jelly : [],
            plankton : [],
            shark : [],
            whale : [],
            virus : [],
            squid : []
        };

        this.effect_pool = [];

        this.SpiritClassList = {
            'Spirit_Fish'       : {class : Spirit_Fish,         pool : this.spirit_pools.fish,        list:GameState.spirits}, 
            'Spirit_Jelly'      : {class : Spirit_Jelly,        pool : this.spirit_pools.jelly,       list:GameState.spirits},
            'Spirit_Plankton'   : {class : Spirit_Plankton,     pool : this.spirit_pools.plankton,    list:GameState.spirits},
            'Spirit_Shark'      : {class : Spirit_Shark,        pool : this.spirit_pools.shark,       list:GameState.spirits},
            'Spirit_Whale'      : {class : Spirit_Whale,        pool : this.spirit_pools.whale,       list:GameState.spirits},
            'Spirit_Virus'      : {class : Spirit_Virus,        pool : this.spirit_pools.virus,       list:GameState.spirits},
            'Spirit_Squid'      : {class : Spirit_Squid,        pool : this.spirit_pools.squid,       list:GameState.spirits}
        }

        this.EffectClassList = {
            'Effect_Extinction' : Effect_Extinction,
            'Effect_Predation'  : Effect_Predation,
            'Effect_Feeding'    : Effect_Feeding
        }

        // ◆クラス状態管理オブジェクトの初期化
        this.SpiritClasses = [
            'Spirit_Fish',
            'Spirit_Jelly',
            'Spirit_Plankton',
            'Spirit_Shark',
            'Spirit_Whale',
            'Spirit_Virus',
            'Spirit_Squid'
        ];
        const DefaultSpiritClassState = () => ({
            generation: 0,
            genome_modifier: {},
            max_num : 10,
            period : 100,
            counter : 0,
            num_infected: 0,
            num_starved: 0,
            num_preyed: 0,
            mutation_threshold: 0,
            lower_chain : [],
            upper_chain : [],
            lower_hp_basis : 100,
            period_basis : 100
        });
        this.spirit_class_state = Object.fromEntries(
            this.SpiritClasses.map(name => [name, DefaultSpiritClassState()])
        );
    } // End of constructor

    activate_spirit(class_name, pos, generation = 0, genome_modifier = null){
        const {class : Class, pool : pool, list : list} = this.SpiritClassList[class_name];

        let object;
        const index = pool.findIndex(obj => obj.generation === generation);
        if ( index !== -1 ){
            object = pool.splice(index, 1)[0];
            // console.log("[SPAWN] activate_spirit REUSE:",class_name, " - ", generation, " length:", pool.length, list.length);
        } else {
            object = new Class(this.scene, class_name, generation);
            object.create(genome_modifier);
            Spirit.setupDepthCloneRenderOrder(this.scene); //半透明ボディ用 depthClone の処理順強制変更
            // console.log("[SPAWN] activate_spirit NEW:",class_name, " - ", generation, " length:", pool.length, list.length);
        }
        object.activate(pos);
        list.push(object);

        return object;
    }

    deactivate_spirit(object){
        const class_name = object.class_name;
        const {generation : generation} = this.spirit_class_state[class_name];
        if (object.generation < generation){
            object.dispose();
            // console.log("[SPAWN] deactivate_spirit DISPOSE:", class_name, generation, object.generation);
        } else {
            object.deactivate();
            const {pool : pool} = this.SpiritClassList[class_name];
            pool.push(object);
            // console.log("[SPAWN] deactivate_spirit POOLING:", class_name, pool.length);
        }
    }

    clean_pool(class_name, generation){
        let removed = 0;
        const {pool : pool} = this.SpiritClassList[class_name];
        for (let i = pool.length - 1; i>= 0; i--) {
            const object = pool[i];
            if (object.generation < generation){
                pool.splice(i, 1);
                object.dispose();
                removed++;
            }
        }
        return removed;
    }

    activate_effect(class_name, pos, params = null){
        const Class = this.EffectClassList[class_name];

        let object;
        const index = this.effect_pool.findIndex(obj => obj.class_name === class_name);
        if ( index !== -1 ){
            object = this.effect_pool.splice(index, 1)[0];
            // console.log("[SPAWN] activate_effect REUSE:",class_name, " length:", this.effect_pool.length, GameState.effects.length);
        } else {
            object = new Class(this.scene, class_name);
            // console.log("[SPAWN] activate_effect NEW:",class_name, " length:", this.effect_pool.length, GameState.effects.length);
        }
        object.activate(pos, params);
        GameState.effects.push(object);

        return object;
    }

    deactivate_effect(object){
        object.deactivate();
        this.effect_pool.push(object);
        // console.log("[SPAWN] deactivate_effect:", object.class_name, this.effect_pool.length);
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
    constructor(scene, spawn){
        this.scene = scene;
        this.spawn = spawn;
        this.state = spawn.spirit_class_state;

        this.mutation_counter = 0;
        this.mutation_period = 10.0;

        this.ecosystem_counter = 0;
        this.ecosystem_period = 2.0;  // 23.0

        this.performance_counter = 0;
        this.performance_period = 120.0;

        this.initialize_class_state();
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
        for(let i=0; i<18; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate_spirit("Spirit_Plankton", pos, 0);
        }
/*
        for(let i=0; i<2; i++){
            const pos = this.random_surface_position(5.0);
            GameState.spawn.activate_spirit("Spirit_Fish", pos, 0);
        }

        for(let i=0; i<3; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate_spirit("Spirit_Shark", pos, 0);
        }

        for(let i=0; i<1; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate_spirit("Spirit_Whale", pos, 0);
        }

        for(let i=0; i<1; i++){
            const pos = this.random_surface_position(4.0);
            GameState.spawn.activate_spirit("Spirit_Squid", pos, 0);
        }



        for(let i=0; i<5; i++){
            const pos = this.random_surface_position(3.0);
            GameState.spawn.activate_spirit("Spirit_Jelly", pos, 0);
        }
*/ 
    }

    initialize_class_state(){

        let st;

        st = this.spawn.spirit_class_state["Spirit_Plankton"];
        st.lower_chain = [];
        st.upper_chain = ["Spirit_Fish", "Spirit_Jelly", "Spirit_Squid", "Spirit_Whale"]
        st.max_num = 80;
        st.period = 1.0;
        st.count = 0;
        st.lower_hp_basis = 0.0;
        st.period_basis = 1.0;

        st = this.spawn.spirit_class_state["Spirit_Virus"];
        st.lower_chain = ["Spirit_Fish", "Spirit_Jelly", "Spirit_Shark", "Spirit_Squid", "Spirit_Whale"];
        st.upper_chain = [];
        st.max_num = 30;
        st.period = 0;
        st.count = 0;
        st.lower_hp_basis = 2540;
        st.period_basis = 1.27;

        st = this.spawn.spirit_class_state["Spirit_Fish"];
        st.lower_chain = ["Spirit_Plankton"];
        st.upper_chain = ["Spirit_Squid", "Spirit_Shark"];
        st.max_num = 50;
        st.period = 0;
        st.count = 0;
        st.lower_hp_basis = 180;
        st.period_basis = 3.5;

        st = this.spawn.spirit_class_state["Spirit_Jelly"];
        st.lower_chain = ["Spirit_Plankton"];
        st.upper_chain = ["Spirit_Squid", "Spirit_Shark"];
        st.max_num = 20;
        st.period = 0;
        st.count = 0;
        st.lower_hp_basis = 280;
        st.period_basis = 10.5;

        st = this.spawn.spirit_class_state["Spirit_Squid"];
        st.lower_chain = ["Spirit_Plankton", "Spirit_Fish", "Spirit_Jelly"];
        st.upper_chain = ["Spirit_Shark"];
        st.max_num = 12;
        st.period = 0;
        st.count = 0;
        st.lower_hp_basis = 1000;
        st.period_basis = 17.0;
        
        st = this.spawn.spirit_class_state["Spirit_Shark"];
        st.lower_chain = ["Spirit_Fish", "Spirit_Squid"];
        st.upper_chain = [];
        st.max_num = 3;
        st.period = 0;
        st.count = 0;
        st.lower_hp_basis = 1000;
        st.period_basis = 31.9;

        st = this.spawn.spirit_class_state["Spirit_Whale"];
        st.lower_chain = ["Spirit_Plankton"];
        st.upper_chain = [];
        st.max_num = 2;
        st.period = 0;
        st.count = 0;
        st.lower_hp_basis = 500;
        st.period_basis = 89.0;
    }

    count_class(class_name) {
        return GameState.spirits.filter(s => s.class_name === class_name).length;
    }

    update(time, delta){
        if (!this.spawn) return;

        // ◆ 突然変異を起こす
        this.mutation_counter += delta / 1000;
        if (this.mutation_counter > this.mutation_period){
            this.mutation_counter = 0;
            for (const cls of this.spawn.SpiritClasses){
                this.cause_mutation(cls);
            }
        }

        // ◆ 生態系（食物連鎖）を調整する
        this.ecosystem_counter += delta / 1000;
        if (this.ecosystem_counter > this.ecosystem_period){
            this.ecosystem_counter = 0;
            for (const cls of this.spawn.SpiritClasses){
                this.regulate_ecosystem(cls);
            }
        }

        // ◆ 一定間隔での生成
        for (const cls of this.spawn.SpiritClasses){
            const st = this.spawn.spirit_class_state[cls];
                if (st.period > 0){
                st.count += delta / 1000;
                if (st.count > st.period){
                    st.count = 0;
                    if (this.count_class(cls) < st.max_num){
                        const pos = this.random_surface_position(20.0);
                        GameState.spawn.activate_spirit(cls, pos, st.generation, st.genome_modifier);
                    }
                }
            }
        }

        // ◆ パフォーマンスログ
        this.performance_counter += delta / 1000;
        if (this.performance_counter > this.performance_period){
            this.performance_counter = 0;

                console.log(
                    "meshes:", this.scene.meshes.length,
                    "materials:", this.scene.materials.length,
                    "textures:", this.scene.textures.length,
                    "geometries:", this.scene.geometries.length,
                    "transformNodes:", this.scene.transformNodes.length
                );
/*
                console.log(
                    "active spirits:", GameState.spirits.length,
                    "active effects:", GameState.effects.length
                );
                console.log("POOL:");
                for (const cls of this.spawn.SpiritClasses){
                    const {pool : pool} = this.spawn.SpiritClassList[cls];
                    console.log(`${cls}:${pool.length}`);
                }
                console.log(`effect:${this.spawn.effect_pool.length}`);
*/
                // this.dumpMaterials(this.scene);
                // this.dumpTextures(this.scene);
        }
    }

    dumpTextures(scene) {
        const summary = { rawTexture: [], canvasDataURL: [], fileTexture: [], unknown: [] };

        scene.textures.forEach((tex, i) => {
            const url = tex.url || tex.name || "";
            if (tex instanceof BABYLON.RawTexture) {
                summary.rawTexture.push(tex.name);
            } else if (url.startsWith("data:")) {
                summary.canvasDataURL.push(tex.name);
            } else if (url.includes("particle.png")) {
                summary.fileTexture.push(tex.name);
            } else {
                summary.unknown.push({ name: tex.name, url });
            }
        });

        console.log("=== Texture Dump ===");
        console.log(`RawTexture(CreateRGBATexture): ${summary.rawTexture.length}`, summary.rawTexture);
        console.log(`Canvas(toDataURL):             ${summary.canvasDataURL.length}`, summary.canvasDataURL);
        console.log(`File(particle.png):            ${summary.fileTexture.length}`, summary.fileTexture);
        console.log(`Unknown:                       ${summary.unknown.length}`, summary.unknown);
    }

    dumpMaterials(scene) {
        const byType = {};
        scene.materials.forEach(mat => {
            const type = mat.getClassName(); // "PBRMaterial", "StandardMaterial" etc.
            byType[type] = (byType[type] || 0) + 1;
        });
        console.log("=== Material Dump ===", byType);

        // albedoTexture を持つものだけ抽出
        const withTex = scene.materials.filter(m =>
            m.albedoTexture || m.diffuseTexture
        );
        console.log(`texture付きmaterial: ${withTex.length}`);

        scene.materials
            .filter(m => m.albedoTexture || m.diffuseTexture)
            .forEach(m => {
                console.log("material:", m.name, 
                            "mesh:", m.getBindedMeshes().map(x => x.name),
                            "texture.url:", m.albedoTexture?.url || m.albedoTexture?.name);
            });
    }

    cause_mutation(cls){
        // 感染数、餓死数、被食数、個体数からなる
        // 脅威（淘汰圧）に応じて（判定時の個体数が少ないほど淘汰圧は大きい）
        // genome_modifier を一部乱数的に変更し
        // ウィルス感染数をリセットし
        // 世代番号を一つ増やす
        let isMutating = false;

        const st = this.state[cls];
        const num = this.count_class(cls);

        // console.log("[MUTATION]:",cls,"(",st.generation,") num:",num," infected:", st.num_infected, " starved:", st.num_starved, " preyed:", st.num_preyed);

        // 突然変異の判定・処理 [TEST]
        if ((st.num_starved > 7 && num < 3) ||    // 餓死パターン
            (st.num_preyed > 150 && num < 3) ||    // 捕食されるパターン A
            (st.num_infecter > 100 && num < 2)){  // ウィルス感染パターン
            st.genome_modifier = {speed : 2.0, accel : 2.0, predation_radius : 2.0}; 
            isMutating = true;
        } else if (st.num_preyed > 915 ){       // 捕食されるパターン B
            st.genome_modifier = {hp_max : 2.0};
            isMutating = true;
        }

        if (isMutating){
            st.generation += 1;

            // 突然変異の予告メッセージ
            const texts = [`${cls} (${st.generation}) mutation are in progress.`];
            const color = "#ff8020";
            GameState.ui_manager.add_scroll_messages(texts, color);

            // [TEST] LOG
            const time = Math.floor(GameState.elapsed_time / 1000);
            const log = `[MUTAT] ${cls}(${st.generation}) num:${num} inf:${st.num_infected} stv:${st.num_starved} pry:${st.num_preyed}`;
            console.log(time,":", log);

            // プールから古い世代のキャラクターを削除する
            const num_removed = this.spawn.clean_pool(cls, st.generation);
            console.log("pool removed:", num_removed);

            // 突然変異判定変数のリセット
            st.num_infected= 0;
            st.num_starved=0;
            st.num_preyed=0;
        }
    }

    regulate_ecosystem(cls){
        // 捕食する側（食物連鎖の下位）を調べ
        // 潤沢なら定期生成間隔を短くし
        // 貧弱なら定期生成間隔を長くする
        const st = this.state[cls];
        if (st.lower_hp_basis === 0) return;  // 下位がいない

        const sum_hp_lower = GameState.spirits.reduce(
            (sum, s) => st.lower_chain.includes(s.class_name) ? sum + s.genome.hp_max : sum,
            0
        );
        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
        const ratio = clamp((sum_hp_lower / st.lower_hp_basis), 0.5, 2.0);
        // console.log("[ECO]:", cls, sum_hp_lower, st.lower_hp_basis, ratio);

        if (st.period === 0){
            if (ratio > 1.0){
                // 初めて、捕食対象のHP合計が、基準値を突破
                st.period = st.period_basis / ratio;
                // 新しい種族の登場予告メッセージ
                const texts = [`${cls} will appear in ${Math.floor(st.period)} seconds`];
                const color = "#09e0ff";
                GameState.ui_manager.add_scroll_messages(texts, color);

                // [TEST] LOG
                const time = Math.floor(GameState.elapsed_time / 1000);
                const log = `[ECOSYS] ${cls} - ${sum_hp_lower} / ${st.lower_hp_basis}`;
                console.log(time,":", log);
            }
        } else {
            // console.log("[ECO] ", cls, " sufficiency:", Math.floor(ratio * 100));
            st.period = st.period_basis / ratio;
        }
    }

    dispose(){
    }

} // End of SpawnScheduler