import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
};

export default function CreateShotsModal({ isOpen, onClose, onSubmit }: Props) {
  const [sequences, setSequences] = useState<string[]>(["SC01", "SC02", "SC03", "SC04", "SC05"]);
  const [newSequence, setNewSequence] = useState("");
  const [selectedSequence, setSelectedSequence] = useState("SC01");
  const [shots, setShots] = useState<string[]>(["SH01", "SH02", "SH03", "SH06", "SH07", "SH05"]);
  const [newShot, setNewShot] = useState("");
  const [shotPadding, setShotPadding] = useState("1");

  const handleAddSequence = () => {
    if (newSequence.trim()) {
      setSequences([...sequences, newSequence.trim()]);
      setSelectedSequence(newSequence.trim());
      setNewSequence("");
    }
  };

  const handleAddShot = () => {
    if (newShot.trim()) {
      setShots([...shots, newShot.trim()]);
      setNewShot("");
    }
  };

  const handleSubmit = () => {
    onSubmit({
      sequences,
      selectedSequence,
      shots,
      shotPadding: parseInt(shotPadding),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-[#1a1a1a] p-8 text-slate-100 shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-6">Create Shots</h1>

        <div className="space-y-6">
          {/* Instructions */}
          <div className="text-sm text-slate-400">
            <p>
              To add shots, you first need to create an episode and a sequence. Type an episode
              name at the bottom of the left column, then click "Add" to create a new episode.
              Select this episode and repeat the same operation for the sequence. Finally, select
              a sequence and type a shot name in the field at the bottom of the right column.
              Click the "Add" button below. Your first shot is now created. You can add many
              more! If it's not a TV show, you can directly create a sequence.
            </p>
          </div>

          {/* Shot Padding */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Shot Padding</label>
            <select
              value={shotPadding}
              onChange={(e) => setShotPadding(e.target.value)}
              className="rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>

          {/* Sequences and Shots */}
          <div className="grid grid-cols-2 gap-4">
            {/* Sequences */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Sequences</h3>
              <div className="h-64 rounded-xl bg-[#2a2a2a] p-3 overflow-y-auto">
                {sequences.map((seq) => (
                  <button
                    key={seq}
                    type="button"
                    onClick={() => setSelectedSequence(seq)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedSequence === seq
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    {seq}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSequence}
                  onChange={(e) => setNewSequence(e.target.value)}
                  placeholder="SC06"
                  className="flex-1 rounded-xl bg-[#2a2a2a] px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddSequence}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Shots */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Shots</h3>
              <div className="h-64 rounded-xl bg-[#2a2a2a] p-3 overflow-y-auto">
                {shots.map((shot) => (
                  <div
                    key={shot}
                    className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5"
                  >
                    {shot}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newShot}
                  onChange={(e) => setNewShot(e.target.value)}
                  placeholder="SH01"
                  className="flex-1 rounded-xl bg-[#2a2a2a] px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddShot}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 px-6 py-2 text-sm font-medium text-slate-300 hover:bg-white/20 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-xl bg-emerald-500 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
            >
              Create Shots
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
