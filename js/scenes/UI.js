// scenes/UI.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { MyMath } from '../utils/MathUtils.js';
import { MyDraw, ScrollMessage } from '../utils/DrawUtils.js';

const FONT_SIZE = 48;
const FONT_HEIGHT = "52px";
const FONT_SPACING = 6;

const MSG_FONT_SIZE = 80;
const MSG_OFFSET_Y = -100;

const STAGE_TITLE_FONT_SIZE = 64;
const STAGE_TITLE_OFFSET_Y = 100;

export class UI {
    constructor(scene) {
        // UI の生成
        this.ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
        this.ui.layer.layerMask = GLOBALS.MASK_UI;
        this.ui.idealWidth = GLOBALS.UI.WIDTH;
        this.ui.idealHeight = GLOBALS.UI.HEIGHT;
        this.ui.renderAtIdealSize = true;

        this.stat_period = 1000;
        this.stat_count = this.stat_period;

        this.scroll_message = new ScrollMessage(this.ui, scene);

        this.create();
    }

    create(){
        // ◆ 左上固定のパネル（コンテナ）
        const panel = new BABYLON.GUI.StackPanel();
        panel.isVertical = true;
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel.paddingTop  = "10px";
        panel.paddingLeft = "10px";
        panel.spacing = FONT_SPACING; //行間(px)
        panel.fontFamily = "MyGameFont";
        this.ui.addControl(panel);
        this.panel = panel;

        const _createTextBlock = (panel, text, color) => {
            const tb = new BABYLON.GUI.TextBlock();
            tb.fontSize = FONT_SIZE;
            tb.height = FONT_HEIGHT;
            tb.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            tb.text = text;
            tb.color = color;
            panel.addControl(tb);
            return tb;
        };

        this.stat_virus = _createTextBlock(panel, "VIRUS:", "magenta");
        this.stat_plankton = _createTextBlock(panel, "PLANKTON:", "#00FF00");
        this.stat_fish = _createTextBlock(panel, "FISH:", "white");
        this.stat_jelly = _createTextBlock(panel, "JELLY:", "white");
        this.stat_squid = _createTextBlock(panel, "SQUID:", "white");
        this.stat_shark = _createTextBlock(panel, "SHARK:", "white");
        this.stat_whale = _createTextBlock(panel, "WHALE:", "white");
        this.stat_elapsed = _createTextBlock(panel, "ELAPSED:", "cyan");

        // ◆ ステータスメッセージ
        let tobj = new BABYLON.GUI.TextBlock();
        tobj.alpha = 0.0;
        tobj.fontSize = MSG_FONT_SIZE;
        this.ui.addControl(tobj);
        this.statusMessageText = tobj;

    }

    show_status_message(str, color="#ffffff"){
        this.statusMessageText.text = str;
        this.statusMessageText.color = color;
        this.statusMessageText.fontFamily = "MyGameFont";
        this.statusMessageText.fontSize = MSG_FONT_SIZE;
        MyDraw.set_text_center(this.statusMessageText, 0, MSG_OFFSET_Y);
    }

    hide_status_message(){
        this.statusMessageText.alpha = 0.0;
    }

    add_scroll_messages(texts, color){
        this.scroll_message.add_texts(texts, color);
    }

    _stat_text(cls){
        const hps = GameState.spirits
            .filter(s => s.class_name === cls)
            .map(s => s.hp);
        if (hps.length === 0) return `0 HP:-`;

        const sum = hps.reduce((a, b) => a + b, 0);
        if (hps.length === 1) return `1 HP:${Math.floor(sum)}`;

        return `${hps.length} HP:${Math.floor(Math.min(...hps))}-${Math.floor(sum / hps.length)}-${Math.floor(Math.max(...hps))}`;
    }

    update_stat(){
        this.stat_virus.text = `Virus: ${this._stat_text("Spirit_Virus")}`;
        this.stat_plankton.text = `Plankton: ${this._stat_text("Spirit_Plankton")}`;
        this.stat_fish.text = `Fish: ${this._stat_text("Spirit_Fish")}`;
        this.stat_jelly.text = `Jelly: ${this._stat_text("Spirit_Jelly")}`;
        this.stat_squid.text = `Squid: ${this._stat_text("Spirit_Squid")}`;
        this.stat_shark.text = `Shark: ${this._stat_text("Spirit_Shark")}`;
        this.stat_whale.text = `Whale: ${this._stat_text("Spirit_Whale")}`;

        const elapsed_sec = Math.floor(GameState.elapsed_time / 1000);
        this.stat_elapsed.text = `Elapsed: ${Math.floor(elapsed_sec / 60).toString().padStart(2,'0')}:${(elapsed_sec % 60).toString().padStart(2,'0')}`
    }

    update(time, delta){
        this.scroll_message.update(time, delta);

        this.stat_count -= delta;
        if (this.stat_count <0){
            this.stat_count = this.stat_period;
            this.update_stat();
        }
    }

    dispose(){
        if (this.scoreText){
            this.scoreText.dispose();
            this.scoreText = null;
        }

        if (this.panel){
            this.panel.dispose();
            this.panel = null;
        }
        if (this.status_message){
            this.status_message.dispose();
            this.status_message = null;
        }

        this.ui.dispose();
    }
} // End of UI
