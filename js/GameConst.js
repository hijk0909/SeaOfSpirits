// GameConst.js

export const GLOBALS = {

    VERSION : "0.8d",
    DATE : "2026.4.20",

    DELTA : 16.6667,
    DELTA_CLAMP : 20,
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
        IMPULSE_VELOCITY_RATIO : 1.5, // 大きくすると、唐突な吹っ飛びケースが増えるが、小さいと、ひっつく時間が長くなりがち
        MAX_EXTERNAL_VELOCITY : 1.2,
        EXTERNAL_VELOCITY_DAMPING : 0.95,
        OVERLAP_RESOLUTION_RATIO : 0.1,  // 大きくすると、瞬間移動幅が大きくなる
        OVERLAP_RESOLUTION_THRESHOLD : 0.1,
        MAX_REPULSE_VELOCITY : 0.6
    },

    GROUND : {
        Y : - 10.0,
        UPDOWN : 2
    }
}