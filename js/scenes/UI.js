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

const STAT_PERIOD = 1.0; // 再表示間隔

export class UI {
    constructor(scene) {
        this.scene = scene;

        // UI の生成
        this.ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
        this.ui.layer.layerMask = GLOBALS.MASK_UI;
        this.ui.idealWidth = GLOBALS.UI.WIDTH;
        this.ui.idealHeight = GLOBALS.UI.HEIGHT;
        this.ui.renderAtIdealSize = true;

        this.stat_count = 0;

        this.scroll_message = new ScrollMessage(this.ui, scene);

        // SceneInstrumentation（描画・フレーム関連）
        this.sceneInst = new BABYLON.SceneInstrumentation(this.scene);
        this.sceneInst.captureFrameTime = true;       // Frame total / Absolute FPS に必要
        this.sceneInst.captureDrawCalls = true;       // Draw calls に必要
        // EngineInstrumentation（GPU関連）
        this.engineInst = new BABYLON.EngineInstrumentation(GameState.game.engine);
        this.engineInst.captureGPUFrameTime = true;   // GPU Frame time に必要

        this.create();
    }

    create(){
        // テキスト生成ヘルパー関数
        const _createTextBlock = (panel, text, color, align) => {
            const tb = new BABYLON.GUI.TextBlock();
            tb.fontSize = FONT_SIZE;
            tb.height = FONT_HEIGHT;
            tb.textHorizontalAlignment = align;
            tb.text = text;
            tb.color = color;
            panel.addControl(tb);
            return tb;
        };

        // ◆ 左上固定のパネル（コンテナ）
        const panel_L = new BABYLON.GUI.StackPanel();
        panel_L.isVertical = true;
        panel_L.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel_L.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel_L.paddingTop  = "10px";
        panel_L.paddingLeft = "10px";
        panel_L.spacing = FONT_SPACING; //行間(px)
        panel_L.fontFamily = "MyGameFont";
        this.ui.addControl(panel_L);
        this.panel_L = panel_L;

        const al = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.stat_plankton = _createTextBlock(panel_L, "PLANKTON:", "#40FF80", al);
        this.stat_fish = _createTextBlock(panel_L, "FISH:", "white", al);
        this.stat_jelly = _createTextBlock(panel_L, "JELLY:", "white", al);
        this.stat_squid = _createTextBlock(panel_L, "SQUID:", "white", al);
        this.stat_shark = _createTextBlock(panel_L, "SHARK:", "white", al);
        this.stat_whale = _createTextBlock(panel_L, "WHALE:", "white", al);
        this.stat_virus = _createTextBlock(panel_L, "VIRUS:", "#FF80FF", al);
        this.stat_elapsed = _createTextBlock(panel_L, "ELAPSED:", "#80FFFF", al);

        // ◆ 右上固定のパネル（コンテナ）
        const panel_R = new BABYLON.GUI.StackPanel();
        panel_R.isVertical = true;
        panel_R.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel_R.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel_R.paddingTop  = "10px";
        panel_R.paddingLeft = "-10px";
        panel_R.spacing = FONT_SPACING; //行間(px)
        panel_R.fontFamily = "MyGameFont";
        this.ui.addControl(panel_R);
        this.panel_R = panel_R;

        const ar = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.stat_absFps = _createTextBlock(panel_R, "Absolute FPS:","#C0C0C0", ar);
        this.stat_fps = _createTextBlock(panel_R, "FPS:","white", ar);
        this.stat_frameTotal = _createTextBlock(panel_R, "Frame:","#C0C0C0", ar);
        this.stat_gpuFrame = _createTextBlock(panel_R, "GPU:","#C0C0C0", ar);
        this.stat_drawCalls = _createTextBlock(panel_R, "Draw calls:","#C0C0C0", ar);
        this.stat_totalMeshes = _createTextBlock(panel_R, "Meshes:","#C0C0C0", ar);

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

        this.stat_absFps.text = `Absolute FPS: ${(1000 / this.sceneInst.frameTimeCounter.lastSecAverage).toFixed(1)}`;
        this.stat_fps.text = `FPS: ${GameState.game.engine.getFps().toFixed(1)}`;
        this.stat_frameTotal.text = `Frame: ${this.sceneInst.frameTimeCounter.lastSecAverage.toFixed(2)} msec`;
        this.stat_gpuFrame.text = `GPU: ${(this.engineInst.gpuFrameTimeCounter.lastSecAverage / 1000000).toFixed(2)} msec`;
        this.stat_drawCalls.text = `Draw calls: ${this.sceneInst.drawCallsCounter.current}`;
        this.stat_totalMeshes.text = `Meshes: ${this.scene.meshes.length}`;
    }

    update(time, delta){
        this.scroll_message.update(time, delta);

        this.stat_count += delta / 1000;
        if (this.stat_count >= STAT_PERIOD){
            this.stat_count = 0;
            this.update_stat();
        }
    }

    dispose(){
        if (this.scoreText){
            this.scoreText.dispose();
            this.scoreText = null;
        }

        if (this.panel_L){
            this.panel_L.dispose();
            this.panel_L = null;
        }

        if (this.panel_R){
            this.panel_R.dispose();
            this.panel_R = null;
        }

        if (this.status_message){
            this.status_message.dispose();
            this.status_message = null;
        }

        this.ui.dispose();
    }
} // End of UI
