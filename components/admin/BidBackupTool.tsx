'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface BidBackupToolProps {
  gameId: string;
  adminUserId: string;
  auctionPeriods: Array<{
    name: string;
    startDate: any;
    endDate: any;
  }>;
}

export function BidBackupTool({ gameId, adminUserId, auctionPeriods }: BidBackupToolProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{
    messagesSent: number;
    details: Array<{
      userId: string;
      playername: string;
      ridersCount: number;
    }>;
  } | null>(null);
  const [deleteResult, setDeleteResult] = useState<{
    deletedCount: number;
    details: {
      totalBids: number;
      bidsInPeriod: number;
      deletedBids: number;
    };
  } | null>(null);
  const [deletePreview, setDeletePreview] = useState<{
    totalBids: number;
    bidsToDelete: number;
    affectedPlayers: number;
    bidsDetails: Array<{
      playername: string;
      riderName: string;
      amount: number;
      bidAt: string;
    }>;
  } | null>(null);
  const [previewingDelete, setPreviewingDelete] = useState(false);
  const [preview, setPreview] = useState<{
    totalPlayers: number;
    totalBids: number;
    preview: Array<{
      userId: string;
      playername: string;
      bids: Array<{
        riderName: string;
        amount: number;
      }>;
    }>;
  } | null>(null);

  const handleSendBackup = async () => {
    if (!confirm(`Weet je zeker dat je bid backup berichten wilt versturen voor ${auctionPeriods[selectedPeriod].name}?`)) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/send-bid-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          auctionPeriodIndex: selectedPeriod,
          adminUserId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send backup messages');
      }

      setResult(data);
      toast.success(`${data.messagesSent} berichten succesvol verzonden!`);
    } catch (error: any) {
      console.error('Error sending bid backup:', error);
      toast.error(error.message || 'Er is een fout opgetreden');
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreview(null);

    try {
      const response = await fetch('/api/admin/preview-bid-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          auctionPeriodIndex: selectedPeriod,
          adminUserId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview');
      }

      setPreview(data);
      toast.success('Preview geladen!');
    } catch (error: any) {
      console.error('Error previewing:', error);
      toast.error(error.message || 'Er is een fout opgetreden bij het laden van preview');
    } finally {
      setPreviewing(false);
    }
  };

  const handlePreviewDelete = async () => {
    setPreviewingDelete(true);
    setDeletePreview(null);

    try {
      const response = await fetch('/api/admin/preview-delete-bids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          auctionPeriodIndex: selectedPeriod,
          adminUserId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview delete');
      }

      setDeletePreview(data);
      toast.success('Delete preview geladen!');
    } catch (error: any) {
      console.error('Error previewing delete:', error);
      toast.error(error.message || 'Er is een fout opgetreden bij het laden van preview');
    } finally {
      setPreviewingDelete(false);
    }
  };

  const handleDeleteBids = async () => {
    const periodName = auctionPeriods[selectedPeriod].name || `Ronde ${selectedPeriod + 1}`;

    if (!confirm(`⚠️ WAARSCHUWING ⚠️\n\nWeet je ABSOLUUT ZEKER dat je alle biedingen wilt verwijderen uit ${periodName}?\n\nDit kan NIET ongedaan worden gemaakt!\n\nKlik OK om te verwijderen, of Annuleren om te stoppen.`)) {
      return;
    }

    // Double confirmation
    if (!confirm(`Laatste bevestiging: Typ je snapt dat dit ALLE biedingen uit ${periodName} permanent verwijdert?`)) {
      return;
    }

    setDeleting(true);
    setDeleteResult(null);

    try {
      const response = await fetch('/api/admin/delete-period-bids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          auctionPeriodIndex: selectedPeriod,
          adminUserId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete bids');
      }

      setDeleteResult(data);
      toast.success(`${data.deletedCount} biedingen succesvol verwijderd!`);
    } catch (error: any) {
      console.error('Error deleting bids:', error);
      toast.error(error.message || 'Er is een fout opgetreden bij het verwijderen');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">Bid Backup Tool</h3>
      <p className="text-sm text-gray-600 mb-4">
        Verstuur aan alle spelers een bericht met een lijst van renners waarop ze hadden geboden in een specifieke biedronde.
        Dit is handig voordat je biedingen verwijdert en opnieuw laat plaatsvinden.
      </p>

      <div className="mb-4">
        <label htmlFor="auction-period" className="block text-sm font-medium text-gray-700 mb-2">
          Selecteer biedronde:
        </label>
        <select
          id="auction-period"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(Number(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={sending}
        >
          {auctionPeriods.map((period, index) => (
            <option key={index} value={index}>
              {period.name || `Ronde ${index + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <button
          onClick={handlePreview}
          disabled={sending || deleting || previewing || previewingDelete}
          className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {previewing ? 'Preview laden...' : '👁️ Preview wat verstuurd gaat worden'}
        </button>

        <button
          onClick={handleSendBackup}
          disabled={sending || deleting || previewing || previewingDelete}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Berichten versturen...' : 'Verstuur Backup Berichten'}
        </button>

        <button
          onClick={handlePreviewDelete}
          disabled={sending || deleting || previewing || previewingDelete}
          className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {previewingDelete ? 'Preview laden...' : '👁️ Preview welke biedingen verwijderd worden'}
        </button>

        <button
          onClick={handleDeleteBids}
          disabled={sending || deleting || previewing || previewingDelete}
          className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {deleting ? 'Biedingen verwijderen...' : '🗑️ Verwijder ALLE biedingen uit deze ronde'}
        </button>
      </div>

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">
            ✅ {result.messagesSent} berichten verzonden
          </h4>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-green-200">
                  <th className="text-left py-2">Speler</th>
                  <th className="text-right py-2">Aantal biedingen</th>
                </tr>
              </thead>
              <tbody>
                {result.details.map((detail, idx) => (
                  <tr key={idx} className="border-b border-green-100">
                    <td className="py-2">{detail.playername}</td>
                    <td className="text-right py-2">{detail.ridersCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">
            👁️ Preview: {preview.totalPlayers} spelers ontvangen een bericht ({preview.totalBids} totale biedingen)
          </h4>
          <div className="max-h-96 overflow-y-auto space-y-3 mt-4">
            {preview.preview.map((player, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-blue-200">
                <div className="font-semibold text-blue-900 mb-2">
                  {player.playername} ({player.bids.length} biedingen)
                </div>
                <div className="text-sm space-y-1">
                  {player.bids.map((bid, bidIdx) => (
                    <div key={bidIdx} className="text-gray-700">
                      • {bid.riderName} - €{bid.amount.toFixed(1)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deletePreview && (
        <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h4 className="font-semibold text-orange-800 mb-2">
            👁️ Delete Preview: {deletePreview.bidsToDelete} biedingen zullen worden verwijderd
          </h4>
          <div className="text-sm text-orange-700 space-y-1 mb-4">
            <p>Totaal aantal biedingen in game: {deletePreview.totalBids}</p>
            <p>Biedingen in deze periode die verwijderd worden: {deletePreview.bidsToDelete}</p>
            <p>Aantal spelers die geraakt worden: {deletePreview.affectedPlayers}</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm bg-white rounded">
              <thead className="bg-orange-100 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 border-b border-orange-200">Speler</th>
                  <th className="text-left py-2 px-3 border-b border-orange-200">Renner</th>
                  <th className="text-right py-2 px-3 border-b border-orange-200">Bedrag</th>
                  <th className="text-right py-2 px-3 border-b border-orange-200">Datum</th>
                </tr>
              </thead>
              <tbody>
                {deletePreview.bidsDetails.map((bid, idx) => (
                  <tr key={idx} className="border-b border-orange-100 hover:bg-orange-50">
                    <td className="py-2 px-3">{bid.playername}</td>
                    <td className="py-2 px-3">{bid.riderName}</td>
                    <td className="text-right py-2 px-3">€{bid.amount.toFixed(1)}</td>
                    <td className="text-right py-2 px-3 text-xs">
                      {new Date(bid.bidAt).toLocaleString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteResult && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">
            🗑️ {deleteResult.deletedCount} biedingen verwijderd
          </h4>
          <div className="text-sm text-red-700 space-y-1">
            <p>Totaal aantal biedingen in game: {deleteResult.details.totalBids}</p>
            <p>Biedingen in deze periode: {deleteResult.details.bidsInPeriod}</p>
            <p>Verwijderde biedingen: {deleteResult.details.deletedBids}</p>
          </div>
        </div>
      )}
    </div>
  );
}
