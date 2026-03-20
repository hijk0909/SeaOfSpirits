// UITransition.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";

const WIPE_IN_PERIOD = 2000;
const WIPE_OUT_PERIOD = 1000;

export class UITransition {
    constructor(engine) {
        this.engine = engine;
        this.scene = new BABYLON.Scene(engine);
        // this.scene.autoClear = false; //下のシーンを消さない
        this.scene.detachControl(); //入力不要
        this.camera = new BABYLON.FreeCamera("camera_transition", new BABYLON.Vector3(0,2,-5), this.scene);
        this.ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI( "UI_transition", true, this.scene );

        this.create();
    }

    create(){
        // 進捗度
        this.progress = 0;

        // [Loading] ロード中表示文字列
        this.loading_text = new BABYLON.GUI.TextBlock();
        this.loading_text.text = "NOW LOADING...";
        this.loading_text.color = "white";
        this.loading_text.fontFamily = "MyGameFont";
        this.loading_text.fontSize = 32;
        this.loading_text.isVisible = false;
        this.loading_text.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.loading_text.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.loading_text.top = 0;
        this.ui.addControl(this.loading_text);

        this.progress_text = new BABYLON.GUI.TextBlock();
        this.progress_text.text = "0%";
        this.progress_text.color = "cyan";
        this.progress_text.fontFamily = "MyGameFont";
        this.progress_text.fontSize = 32;
        this.progress_text.isVisible = false;
        this.progress_text.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.progress_text.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.progress_text.top = 40;
        this.ui.addControl(this.progress_text);
    }

    show_loading(){
        this.loading_text.isVisible = true;
        this.progress_text.isVisible = true;
        this.progress = 0;
    }

    hide_loading(){
        this.loading_text.isVisible = false;
        this.progress_text.isVisible = false;
    }

    add_progress(prg){
        this.progress = Math.min(1.0, this.progress + prg);
        this.progress_text.text = `${Math.floor(this.progress * 100)}%`;
        // this.progress_text._markAsDirty();
    }

    update(time, delta){
        // console.log("UITransition:update", this.progress);
        this.add_progress(delta / 10000);
    }

    dispose(){
    // 常駐UI なので、原則として dispose() されることは無いハズ
        if (this.loading_text){
            this.loading_text.dispose();
            this.loading_text = null;
        }
        if (this.progress_text){
            this.progress_text.dispose();
            this.progress_text = null;
        }
        this.ui.dispose();
    }
}
