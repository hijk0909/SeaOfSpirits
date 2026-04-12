// GameState.js
import { GLOBALS } from './GameConst.js';

export const GameState = {
    game : null,
    camera : null,
    asset : null,
    pad_manager : null,
    pad : null,
    inputKey : null,
    inputPad : {
        left : false,
        right : false,
        up : false,
        down : false,
        button : false
    },
    inputMouse : {
        button : false,
        x : 0,
        y : 0
    },
    debug : false,

    // ゲーム情報
    score : 0,
    elapsed_time : 0,
    ui_manager : null,
    spawn : null,

    // キャラクター
    player : null,
    spirits : [],
    effects : [],
    bubbles : null,
    remains : null,

    reset(){
        this.elapsed_time = 0;
        this.score = 0;
    },

    add_score(score){
        this.score += score;
    },

    save_storage_results(r1, r2) {
        const data = {
            r1 : r1,
            r2 : r2,
            time : Date.now(),
        };

        localStorage.setItem(
            "SeaOfSpirits_SaveData",
            JSON.stringify(data)
        );
    },

    load_storage_results() {
        const json = localStorage.getItem("SeaOfSpirits_SaveData");
        if (!json) {
            return null;
        }

        let r1 = null;
        let r2 = null;
        let time = null;

        try {
            const data = JSON.parse(json);

            r1 = data.r1 ?? "";
            r2 = data.r2 ?? "";
            time = data.time ?? "";
        } catch (e) {
            console.warn("Result load failed.", e);
        }

        return { r1, r2, time };
    },

    remove_storage_results() {
        localStorage.removeItem("SeaOfSpirits_SaveData");
    }
}