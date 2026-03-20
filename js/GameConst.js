// GameConst.js

export const GLOBALS = {

    VERSION : "0.3",
    DATE : "2026.3.21",

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
        IMPULSE_VELOCITY_RATIO : 0.6,
        CONTROL_LOSS_THRESHOLD : 0.1,
        MAX_EXTERNAL_VELOCITY : 0.5,
        OVERLAP_REPULSION_COEFFICIENT : 0.6,
        MAX_REPULSE_VELOCITY : 0.2
    },

}