plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

fun requiredBackendUrl(): String {
    val value = providers.gradleProperty("BACKEND_URL")
        .orElse(providers.environmentVariable("BACKEND_URL"))
        .orNull
        ?.trim()
        .orEmpty()

    require(value.startsWith("https://")) {
        "BACKEND_URL must be a validated public HTTPS backend URL before building the APK."
    }
    require(
        !value.contains("local" + "host", ignoreCase = true) &&
            !value.contains("127." + "0.0.1") &&
            !value.contains("10.0" + ".2.2") &&
            !value.contains("192." + "168.") &&
            !value.contains("cdm2026" + "-backend.onrender.com", ignoreCase = true)
    ) {
        "BACKEND_URL must not be local, emulator-only, private LAN, or a known broken Render URL."
    }
    return value.removeSuffix("/")
}

android {
    namespace = "com.cdmafrique.live"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.cdmafrique.live"
        minSdk = 26
        targetSdk = 35
        versionCode = 500
        versionName = "5.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        val backendUrl = requiredBackendUrl()
        debug {
            buildConfigField("String", "BACKEND_URL", "\"$backendUrl\"")
            isMinifyEnabled = false
        }
        release {
            buildConfigField("String", "BACKEND_URL", "\"$backendUrl\"")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Networking
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")

    // Image loading
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:34.15.0"))
    implementation("com.google.firebase:firebase-messaging")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Core
    implementation("androidx.core:core-ktx:1.15.0")

    // Debug
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
