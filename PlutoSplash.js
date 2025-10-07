function tryLegacyStore(appId) {
    var service = new tizen.ApplicationControl(
        "http://tizen.org/appcontrol/operation/view",
        `tizenstore://ProductDetail/${appId}`,
        null, null, null
    );

    var legacyStoreId = "org.tizen.tizenstore";

    try {
        tizen.application.launchAppControl(
            service,
            legacyStoreId,
            function() {
                console.log("Fallback successful: Legacy store launched");
            },
            function(err) {
                console.log("Fallback failed: Legacy store could not be launched. Both store attempts failed.", err.message);
                launchSmartHub();
            },
            null
        );
    } catch (err) {
        console.error("Exception on legacy store launch:", err.message);
        launchSmartHub();
    }
}

function redirectToTizenStore(appId) {
    if (!appId) {
        console.error("Update failed: 'application_id' is missing from Firebase config.");
        return;
    }

    var service = new tizen.ApplicationControl(
        "http://tizen.org/appcontrol/operation/view",
        `tizenstore://ProductDetail/${appId}`,
        null, null, null
    );

    var storeId = "com.samsung.tv.store";

    try {
        tizen.application.launchAppControl(
            service,
            storeId,
            function() {
                console.log("Primary attempt: Store Service launched successfully");
            },
            function(err) {
                console.log("Primary attempt failed: Failed to launch store: " + err.message);
                tryLegacyStore(appId);
            },
            null
        );
    } catch (err) {
        console.error("Exception on primary store launch:", err);
        tryLegacyStore(appId);
    }
}
