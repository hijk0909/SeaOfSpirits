// MathUtils.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';

export class MyMath {

    static rotate_to_front( theta, phi) {
        // 角度→ラジアン
        const radTheta1 = theta * Math.PI / 180;
        const radPhi1 = phi * Math.PI / 180;

        // 直交座標化
        const x = Math.cos(radTheta1) * Math.sin(radPhi1);
        const y = Math.sin(radTheta1);
        const z = Math.cos(radTheta1) * Math.cos(radPhi1);

        // X軸を中心に回転 (90度)
        const x2 = x;
        const y2 = z;
        const z2 = y;

        // 極座標化
        const radTheta2 = Math.asin(y2);
        const radPhi2 = Math.atan2(x2, z2);

        // ラジアン→角度
        const theta2 = radTheta2 * 180 / Math.PI;
        const phi2 = radPhi2 * 180 / Math.PI;

        return { theta: theta2, phi: phi2 };
    }

    static shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
          return array;
    }

    static get_ui_scale(){
        // UI画面のスケールは常に横幅で決まる
        return GameState.game.engine.getRenderWidth() / GLOBALS.UI.WIDTH;
    }

    static world_to_screen(world_pos) {
        const rw = GameState.game.engine.getRenderWidth();
        const rh = GameState.game.engine.getRenderHeight();

        const transformMatrix = GameState.camera.getTransformationMatrix();
        const screen_pos = BABYLON.Vector3.Project(
            world_pos,
            BABYLON.Matrix.Identity(),
            transformMatrix,
            GameState.camera.viewport.toGlobal(rw, rh)
        );

        const scale = this.get_ui_scale();
        screen_pos.x = screen_pos.x / scale;
        screen_pos.y = screen_pos.y / scale;

        return screen_pos;
    }

    static screen_to_world_at_ndc(screen_pos, ndc_z = 0) {
        const rw = GameState.game.engine.getRenderWidth();
        const rh = GameState.game.engine.getRenderHeight();
        const scale = this.get_ui_scale();

        // UI座標系 → ピクセル座標
        const pixel_x = screen_pos.x * scale;
        const pixel_y = screen_pos.y * scale;

        // const transformMatrix = GameState.camera.getTransformationMatrix();
        const viewport = GameState.camera.viewport.toGlobal(rw, rh);

        const world_pos = BABYLON.Vector3.Unproject(
            new BABYLON.Vector3(pixel_x, pixel_y, ndc_z),
            rw,
            rh,
            BABYLON.Matrix.Identity(),
            GameState.camera.getViewMatrix(),
            GameState.camera.getProjectionMatrix(),
            viewport
        );

        return world_pos;
    }

    static screen_to_world_at_z(screen_pos, z=0){
        const near = this.screen_to_world_at_ndc(screen_pos, 0);
        const far  = this.screen_to_world_at_ndc(screen_pos, 1);

         // nearからfarへのレイとZ平面の交点
        const t = (z - near.z) / (far.z - near.z);
        return BABYLON.Vector3.Lerp(near, far, t);
    }

    static mouse_to_world(mx, my, z){
        const scale = this.get_ui_scale();
        return this.screen_to_world_at_z({x:(mx /scale), y:(my/scale)}, z);
    }

    static clamp_ui_object(org_left, org_top, x_pad, y_pad, x_width, y_height){

        const rh = GameState.game.engine.getRenderHeight(); //現在のブラウザの縦幅

        const scale = this.get_ui_scale();
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const clamped_x = clamp(org_left, x_pad, GLOBALS.UI.WIDTH - x_pad - x_width);
        const clamped_y = clamp(org_top, y_pad, rh / scale - y_pad - y_height);

        return { left:clamped_x, top:clamped_y}
    }
}