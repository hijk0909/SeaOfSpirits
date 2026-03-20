// GameOverAsset.js
import { Asset } from './base_asset.js';
import { MyAudio } from "../utils/AudioUtils.js"

export class GameOverAsset extends Asset {
    constructor(scene) {
        super(scene);
    }

    async preload(){
        await MyAudio.initialize();

        this.jingle.gameover = await MyAudio.load( "./assets/audio/jingle/jingle_game_over.mp3" );
        this.jingle.gameover.setVolume(0.8);
    }

    dispose(){
        super.dispose();
    }
}