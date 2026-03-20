import {UITransition} from "./scenes/UITransition.js";

export class SceneManager {
    constructor(engine, canvas) {
        this.engine = engine;
        this.canvas = canvas;
        this.currentScene = null;
        this.isChangingScene = false; 
        this.ui_transition = new UITransition(engine);
        this.progress = false;
    }

    async changeScene(newScene, progress = false) {
        this.progress = progress;
        if (this.isChangingScene) return;  // 二重遷移防止
        // 呼び出し側は await せず（fire & forget)、その後に何も処理はしないこと
        this.isChangingScene = true;
        if (progress){
            this.ui_transition.show_loading();
        }
        if (this.currentScene) {
            this.currentScene.dispose();
        }
        this.currentScene = newScene;
        await this.currentScene.initialize();
        if (progress){
            this.ui_transition.hide_loading();
        }
        this.currentScene.isInitialized = true;
        this.isChangingScene = false;
        this.canvas.focus();
    }

    add_progress(prg){
        this.ui_transition.add_progress(prg);
    }

    update(time, delta) {
        if (this.currentScene && this.currentScene.scene) {
            if (this.currentScene.isInitialized){
                this.currentScene.update(time, delta);
            }
            this.currentScene.scene.render();
        }
        if (this.isChangingScene && this.progress){
            this.ui_transition.update(time, delta);
            this.ui_transition.scene.render();
        }
    }
}
