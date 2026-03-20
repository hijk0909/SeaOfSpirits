// GameConst.js

export const GLOBALS = {

    VERSION : "0.2",
    DATE : "2026.3.20",

    DELTA : 16.6667,
    ZERO_VECTOR : BABYLON.Vector3.Zero(),

    MASK_UI : 0x10000000,
    UI : {
        WIDTH : 1920,
        HEIGHT : 1080,
        FONT_RATIO : 1.7
    },

    STAGE_STATE: {
        START : 1,
        STARTING : 2,
        PLAYING : 3,
        FAIL : 4,
        FAILED : 5,
        CLEAR : 6,
        CLEARED : 7,
        ALL_CLEARED : 8,
        PAUSE : 9
    },

    COLLIDABLE : {
        OVERLAP_REPULSION_COEFFICIENT : 0.6,
        IMPULSE_VELOCITY_RATIO : 1.0,
        CONTROL_LOSS_THRESHOLD : 0.1,
        MAX_EXTERNAL_VELOCITY : 0.5,
        MAX_REPULSE_VELOCITY : 0.5
    },

}