package com.callshield.india

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

/**
 * RecyclerView adapter for the recent lookup history in the dialer.
 */
class RecentLookupAdapter(
    private var entries: List<ScamNumber>,
    private val onEntryClick: (ScamNumber) -> Unit
) : RecyclerView.Adapter<RecentLookupAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val numberText: TextView = view.findViewById(R.id.recentNumber)
        val verdictText: TextView = view.findViewById(R.id.recentVerdict)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_recent_lookup, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val entry = entries[position]
        holder.numberText.text = PhoneNumberUtils.forDisplay(entry.phoneNumber)

        val verdict = when {
            entry.shouldBlock || entry.threatScore >= 70 -> "🚫 ${entry.scamType ?: "Blocked"}"
            entry.threatScore >= 40 -> "⚠️ ${entry.scamType ?: "Suspicious"}"
            else -> "✅ Safe"
        }
        holder.verdictText.text = verdict

        holder.itemView.setOnClickListener { onEntryClick(entry) }
    }

    override fun getItemCount(): Int = entries.size

    fun update(newEntries: List<ScamNumber>) {
        entries = newEntries
        notifyDataSetChanged()
    }
}
