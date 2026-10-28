import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release credentials live outside the repository. A release task fails before
// it can create an artifact unless all four values below are present and the
// keystore exists. In particular, never fall back to the debug signing key: a
// bundle named "release" must be safe to hand to Play without guesswork.
val keyPropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties().apply {
    if (keyPropertiesFile.exists()) keyPropertiesFile.inputStream().use { load(it) }
}
val releaseSigningKeys = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
val hasReleaseSigningValues = releaseSigningKeys.all {
    !keystoreProperties.getProperty(it).isNullOrBlank()
}
val releaseStoreFile = if (hasReleaseSigningValues) {
    rootProject.file(keystoreProperties.getProperty("storeFile"))
} else {
    null
}
val hasReleaseKeystore = releaseStoreFile?.isFile == true

android {
    namespace = "in.galleryzone.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "in.galleryzone.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = releaseStoreFile
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseKeystore) signingConfig = signingConfigs.getByName("release")
            // R8 on, with the Flutter-provided rules. Left off until now
            // because a debug-only project gains nothing from it; a release
            // bundle does, and the app pulls in fl_chart, image_picker and
            // url_launcher, none of which need keep rules beyond their own.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

// Keep IDE sync and debug builds usable without local release secrets, but
// fail every task that could produce or validate a release variant.
tasks.configureEach {
    if (!hasReleaseKeystore && name.contains("release", ignoreCase = true)) {
        doFirst {
            val reason = when {
                !keyPropertiesFile.exists() -> "android/key.properties is missing"
                !hasReleaseSigningValues ->
                    "android/key.properties must define ${releaseSigningKeys.joinToString()}"
                else -> "the configured storeFile does not exist: $releaseStoreFile"
            }
            throw GradleException(
                "Refusing to build a GalleryZone release: $reason. " +
                    "Copy android/key.properties.example, point it at the private Play upload keystore, and retry.",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
