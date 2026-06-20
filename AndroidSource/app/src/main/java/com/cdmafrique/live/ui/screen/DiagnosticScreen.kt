package com.cdmafrique.live.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cdmafrique.live.data.model.AppDiagnostic
import com.cdmafrique.live.ui.MainViewModel

@Composable
fun DiagnosticScreen(viewModel: MainViewModel) {
    val diagnostic by viewModel.diagnostic.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadDiagnostic()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            "Diagnostic",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        // Backend Status
        if (diagnostic != null) {
            DiagnosticCard(diagnostic!!)
        } else {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            ) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
        }

        // Refresh button
        OutlinedButton(
            onClick = { viewModel.loadDiagnostic() },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Actualiser")
        }

        // Architecture info
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    "Architecture",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                InfoLine("App", "CDM 2026 Live v5.0.0")
                InfoLine("Frontend", "Kotlin + Jetpack Compose")
                InfoLine("Backend", "Node.js + Multi-Agent IA")
                InfoLine("Protocole", "REST API + FCM Push")
                InfoLine("Polling Live", "15 secondes")
                InfoLine("Polling Jour", "30 secondes")
            }
        }

        // Info notice
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f)
            )
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    "ℹ️ À propos",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Cette application utilise un système multi-agent IA pour générer du contenu en temps réel. " +
                    "Toutes les données transitent par le backend sécurisé. Aucune clé API n'est stockée dans l'application.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun DiagnosticCard(diag: AppDiagnostic) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                "État du backend",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Status indicator
            Row(verticalAlignment = Alignment.CenterVertically) {
                val statusColor = when (diag.backendStatus) {
                    "ok", "healthy" -> Color(0xFF4CAF50)
                    "degraded" -> Color(0xFFFF9800)
                    else -> Color(0xFFD32F2F)
                }
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = statusColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = diag.backendStatus.uppercase(),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = statusColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            InfoLine("Version backend", diag.backendVersion ?: "—")
            InfoLine("Uptime", diag.backendUptime?.let { "%.1f s".format(it) } ?: "—")
            InfoLine("Appels API", "${diag.apiCallCount}")
            InfoLine("Dernière erreur", diag.lastError ?: "Aucune")
            InfoLine("Version app", diag.appVersion)
        }
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}
