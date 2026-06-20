package com.cdmafrique.live.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun NotificationsScreen() {
    var goalNotifications by remember { mutableStateOf(true) }
    var cardNotifications by remember { mutableStateOf(true) }
    var startNotifications by remember { mutableStateOf(true) }
    var endNotifications by remember { mutableStateOf(true) }
    var liveUpdates by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            "Notifications",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Text(
            "Configurez les notifications push pour ne rien manquer de la CDM 2026.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Match Events
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp)
        ) {
            Column(modifier = Modifier.padding(4.dp)) {
                Text(
                    "Événements de match",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                )

                NotificationToggle(
                    title = "⚽ Buts",
                    subtitle = "Soyez alerté à chaque but marqué",
                    checked = goalNotifications,
                    onCheckedChange = { goalNotifications = it }
                )

                NotificationToggle(
                    title = "🟨🟥 Cartons",
                    subtitle = "Cartons jaunes et rouges",
                    checked = cardNotifications,
                    onCheckedChange = { cardNotifications = it }
                )

                NotificationToggle(
                    title = "▶️ Début de match",
                    subtitle = "Coup d'envoi de chaque match",
                    checked = startNotifications,
                    onCheckedChange = { startNotifications = it }
                )

                NotificationToggle(
                    title = "⏹️ Fin de match",
                    subtitle = "Résultat final de chaque match",
                    checked = endNotifications,
                    onCheckedChange = { endNotifications = it }
                )
            }
        }

        // Live Updates
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp)
        ) {
            Column(modifier = Modifier.padding(4.dp)) {
                Text(
                    "Mises à jour en direct",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                )

                NotificationToggle(
                    title = "📡 Suivi en direct",
                    subtitle = "Commentaires et changements de score en temps réel",
                    checked = liveUpdates,
                    onCheckedChange = { liveUpdates = it }
                )
            }
        }

        // Info
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f)
            )
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    "ℹ️ Comment ça fonctionne",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Les notifications sont envoyées via Firebase Cloud Messaging. " +
                    "Vous pouvez activer ou désactiver chaque type de notification indépendamment.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun NotificationToggle(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}
