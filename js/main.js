// main.js
import { GameState } from "./GameState.js";
import { SceneManager } from "./SceneManager.js";
import { PadManager } from "./utils/InputUtils.js";
import { TitleScene } from "./scenes/TitleScene.js";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// Game Object
export const Game = {
    engine,
    canvas,
    sceneManager: null
};

function set_shader(){
    BABYLON.Effect.ShadersStore["wipeFragmentShader"] = `
        precision highp float;

        varying vec2 vUV;
        uniform sampler2D textureSampler; // 元の3D画面
        uniform vec2 center;
        uniform float radius;
        uniform float alpha;
        uniform float aspectRatio;

        void main(void) {
            // アスペクト比を補正
            vec2 uv = vUV;
            uv.y /= aspectRatio;
            vec2 correctedCenter = center;
            correctedCenter.y /= aspectRatio;

            float dist = distance(uv, correctedCenter);
            float mask = step(radius, dist);

            vec4 baseColor = texture2D(textureSampler, vUV);
            vec4 wipeColor = vec4(0.0, 0.0, 0.0, 1.0);

            // maskが1なら黒(wipeColor)、0なら元の色(baseColor)を混ぜる
            // alphaを使ってワイプ全体の透明度を制御 (wipe_out の チラツキ対策）
            gl_FragColor = mix(baseColor, wipeColor, mask * alpha);
        }
    `;

    BABYLON.Effect.ShadersStore["sunRayVertexShader"] = `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;

        // thinInstance用 mat4を4つの vec4 で受け取る
        attribute vec4 world0;
        attribute vec4 world1;
        attribute vec4 world2;
        attribute vec4 world3;

        uniform mat4 viewProjection;
        uniform vec3 lightDir;
        varying vec2 vUV;
        varying vec3 vLocalPos;
        varying vec3 vWorldPos;

        void main() {
            vUV = uv;

            // attribute から mat4 を再構成
            mat4 world = mat4(world0, world1, world2, world3);

            vec3 local = position;
            vec3 pivot = vec3(0.0, 0.0, 0.0);
            vec3 p = local;

            vec3 up = vec3(0.0, 1.0, 0.0);
            vec3 axis = normalize(cross(up, lightDir));
            float angle = acos(dot(up, lightDir));
            float c = cos(angle);
            float s = sin(angle);
            float t = 1.0 - c;
            mat3 rot = mat3(
                t*axis.x*axis.x + c,        t*axis.x*axis.y - s*axis.z, t*axis.x*axis.z + s*axis.y,
                t*axis.x*axis.y + s*axis.z, t*axis.y*axis.y + c,        t*axis.y*axis.z - s*axis.x,
                t*axis.x*axis.z - s*axis.y, t*axis.y*axis.z + s*axis.x, t*axis.z*axis.z + c
            );

            p = rot * p;
            vec3 finalLocal = p + pivot;
            vLocalPos = finalLocal;

            vec4 worldPos = world * vec4(finalLocal, 1.0);
            vWorldPos = worldPos.xyz;

            gl_Position = viewProjection * worldPos;
        }
    `;

    BABYLON.Effect.ShadersStore["sunRayFragmentShader"] = `
        precision highp float;

        varying vec2 vUV;
        varying vec3 vLocalPos;

        uniform float alpha;

        void main() {
            // 上が0、下が-高さ
            float h = vLocalPos.y;
            // フェード
            float heightFade = clamp((h + 9.0) / 15.0, 0.0, 1.0);

            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * heightFade);
        }
    `;
}

async function startGame() {

    Game.sceneManager = new SceneManager(engine, canvas);
    Game.sceneManager.changeScene(new TitleScene(Game));
    GameState.game = Game;

    // メインループ
    engine.runRenderLoop(() => {
        Game.sceneManager.update(Date.now(), engine.getDeltaTime());
    });
}

// リサイズ対応
window.addEventListener("resize", () => engine.resize());

// ゲームパッドマネージャの生成
GameState.pad_manager =  new PadManager();

// シェーダーの生成
set_shader();

// ゲーム開始
startGame();