// GameClearScene.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Game } from "../main.js";
import { Scene } from "./base_scene.js";
import { TitleScene } from "./TitleScene.js";
import { GameClearAsset } from "./GameClearAsset.js";
import { MyInput } from "../utils/InputUtils.js"
import { ScrollText } from "../utils/DrawUtils.js"

export class GameClearScene extends Scene {
    constructor(game) {
        super(game);
        this.my_input = null;
        this.asset = null;
        this.scroll_text = null;
        this.image_alpha_count = 0;
        this.information_rain = null;
    }

    setup(){
        // [Camera]
        this.camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 1.5, 6), this.scene);
        this.camera.setTarget(BABYLON.Vector3.Zero());
        this.camera.fov = 0.7; // やや狭めて奥行き強調
        // [UI]
        this.ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.ui.idealWidth = GLOBALS.UI.WIDTH;
        this.ui.idealHeight = GLOBALS.UI.HEIGHT;
        this.ui.renderAtIdealSize = true;

        // [Bloom]
        const imgproc= this.scene.imageProcessingConfiguration;
        imgproc.toneMappingEnabled = true;
        imgproc.exposure = 1.1;
        imgproc.contrast = 1.0;
        const pipeline = new BABYLON.DefaultRenderingPipeline("default", true, this.scene, [this.camera]);
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.01; // どの明るさから発光させるか
        pipeline.bloomIntensity = 3.0; // 発光の強さ
        pipeline.bloomKernel = 64;    // ブラーの広がり具合
    }

    async preload(){
        this.asset = new GameClearAsset(this.scene);
        await this.asset.preload();
    }

    resolve_eval_message(value, defs) {
        for (const def of defs) {
            if (value >= def.min) {
                return def.msg;
            }
        }
       return null;
    }

    create(){
        const scene = this.scene;
        scene.clearColor = new BABYLON.Color4(0,0,0,1);

        // Input
        this.my_input = new MyInput(scene, this.game);
        this.my_input.registerNextAction(() => this.goto_title());

        // Sound
        // this.asset.bgm.epilogue.play(true);
    }

    goto_title(){
        // タイトル画面に遷移
        Game.sceneManager.changeScene(new TitleScene(Game));
    }

    update(time, delta){
        if (this.my_input){
            this.my_input.update(time, delta);
        }


        super.update();
    }

    dispose() {
        if (this.camera){
            this.camera.dispose();
            this.camera = null;
        }
        if (this.my_input){
            this.my_input.dispose();
            this.my_input = null;
        }
        if (this.ui){
            this.ui.dispose();
            this.ui = null;
        }
        if (this.asset){
            this.asset.dispose();
            this.asset = null;
        }
        super.dispose();
    }
}