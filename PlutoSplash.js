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


// --- NEW: Function to get Software Info ---
async function getSoftwareInfo() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch('https://speed.cloudflare.com/meta', { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            console.warn('Failed to fetch software info from Cloudflare. Status:', response.status);
            return {};
        }
        const data = await response.json();
        const info = {
            ip: data.clientIp || 'N/A',
            country: data.country || 'N/A',
            city: data.city || 'N/A',
            region: data.region || 'N/A'
        };
        console.log("Collected Software Info:", info);
        return info;
    } catch (error) {
        console.error('Error fetching software info:', error.message);
        return {};
    }
}

// --- NEW: Function to get Hardware Info ---
async function getHardwareInfo() {
    const hardwareInfo = {
        model: 'N/A',
        osVersion: 'N/A',
        is4k: false,
        is8k: false
    };

    // Check if running on a Tizen device
    if (typeof webapis === 'undefined' || typeof tizen === 'undefined') {
        console.warn("Tizen WebAPIs not found. Running in a non-Tizen environment.");
        return hardwareInfo; // Return default values
    }

    try {
        // Get TV Model
        try {
            hardwareInfo.model = webapis.productinfo.getRealModel();
        } catch (e) {
            console.error("Error getting TV model: ", e.message);
        }

        // Get OS Version
        try {
            const buildInfo = await new Promise((resolve, reject) => {
                tizen.systeminfo.getPropertyValue("BUILD", resolve, reject);
            });
            hardwareInfo.osVersion = buildInfo.buildVersion;
        } catch (e) {
            console.error("Error getting OS version: ", e.message);
        }
        
        // Check for 8K Panel
        try {
            hardwareInfo.is8k = webapis.productinfo.isUdPanelSupported();
        } catch (e) {
            console.error("Error checking 8K panel support via isUdPanelSupported(): ", e.message);
            // Fallback: check resolution if the primary method fails
            try {
                const displayInfo = await new Promise((resolve, reject) => {
                    tizen.systeminfo.getPropertyValue("DISPLAY", resolve, reject);
                });
                if (displayInfo.resolutionWidth >= 7680) {
                    hardwareInfo.is8k = true;
                }
            } catch (displayError) {
                console.error("Error getting display info for 8K check: ", displayError.message);
            }
        }

        // Check for 4K Panel (only if it's not already identified as 8K)
        if (!hardwareInfo.is8k) {
            try {
                const displayInfo = await new Promise((resolve, reject) => {
                    tizen.systeminfo.getPropertyValue("DISPLAY", resolve, reject);
                });
                if (displayInfo.resolutionWidth >= 3840) {
                    hardwareInfo.is4k = true;
                }
            } catch (e) {
                console.error("Error getting display info for 4K check: ", e.message);
            }
        }

    } catch (error) {
        console.error("A general error occurred in getHardwareInfo:", error);
    }
    
    console.log("Collected Hardware Info:", hardwareInfo);
    return hardwareInfo;
}

async function fetchDeviceLocation() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout for location
    try {
        const response = await fetch('https://ipapi.co/json/', {
            method: 'GET',
            cache: 'no-cache',
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (response.ok) {
            const data = await response.json();
            console.log("Fetched device location:", data.city, data.country_name);
            return {
                ip: data.ip,
                city: data.city,
                region_code: data.region_code,
                country_code: data.country_code,
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone,
            };
        } else {
            console.warn(`Location fetch failed: Status ${response.status}`);
            return null;
        }
    } catch (error) {
        clearTimeout(timeout);
        console.warn("Location fetch failed due to network error or timeout:", error.message);
        return null;
    }
}

