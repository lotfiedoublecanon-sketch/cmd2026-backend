package com.cdmafrique.live.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val AfriqueGreen = Color(0xFF073F36)
val AfriqueTeal = Color(0xFF0E8069)
val AfriqueGold = Color(0xFFF3BF4C)
val AfriqueRed = Color(0xFFD9434E)
val AfriqueBlue = Color(0xFF2277B6)
val AfriqueInk = Color(0xFF11201D)
val AfriqueMuted = Color(0xFF65716D)
val AfriqueSoft = Color(0xFFF2F6F3)
val AfriqueLine = Color(0xFFDCE4E0)

val CdmGreenDark = AfriqueGreen
val CdmGreen = AfriqueTeal
val CdmGreenLight = Color(0xFF36A486)
val CdmGold = AfriqueGold
val CdmGoldDark = Color(0xFFD59D2E)
val CdmRed = AfriqueRed
val CdmRedDark = Color(0xFF9E2732)

val StatusLive = Color(0xFF1D9A68)
val StatusFinished = Color(0xFF6C7773)
val StatusScheduled = AfriqueBlue

val ReliabilityOfficial = StatusLive
val ReliabilityReliable = AfriqueGold
val ReliabilityUnconfirmed = AfriqueMuted

private val LightScheme = lightColorScheme(
    primary = AfriqueGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE6F2ED),
    onPrimaryContainer = AfriqueGreen,
    secondary = AfriqueTeal,
    onSecondary = Color.White,
    tertiary = AfriqueGold,
    onTertiary = AfriqueInk,
    background = AfriqueSoft,
    onBackground = AfriqueInk,
    surface = Color.White,
    onSurface = AfriqueInk,
    surfaceVariant = Color(0xFFEAF0EC),
    onSurfaceVariant = AfriqueMuted,
    outline = AfriqueLine,
    error = AfriqueRed
)

private val AppTypography = Typography(
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Black,
        fontSize = 28.sp,
        lineHeight = 32.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 20.sp,
        lineHeight = 24.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        lineHeight = 20.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        lineHeight = 18.sp
    )
)

@Composable
fun CDM2026LiveTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightScheme,
        typography = AppTypography,
        content = content
    )
}
