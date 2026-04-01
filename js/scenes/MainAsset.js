// game_asset.js
import { GameState } from '../GameState.js';
import { Asset } from './base_asset.js';
import { MyAudio } from "../utils/AudioUtils.js"

export class MainAsset extends Asset {
    constructor(scene) {
        super(scene);
    }

    async preload(){

        // ■ テクスチャ
        const ptx = new BABYLON.Texture("./assets/textures/particle.png", this.scene);
        ptx.hasAlpha = true;
        this.texture.particle = ptx;

        // ■　音声
        this.se.collision = await MyAudio.load( "./assets/audio/se/se_collision.mp3" );
        this.se.collision.setVolume(0.8);

        this.se.predation = await MyAudio.load( "./assets/audio/se/se_predation.mp3" );
        this.se.predation.setVolume(0.8);

        this.se.extinction = await MyAudio.load( "./assets/audio/se/se_extinction.mp3" );
        this.se.extinction.setVolume(0.8);

        this.se.feeding = await MyAudio.load( "./assets/audio/se/se_feeding.mp3" );
        this.se.feeding.setVolume(0.8);

        GameState.game.sceneManager.add_progress(1.0);
        // console.log("asset.preload:end");
    }

    dispose(){
        super.dispose();
    }
}