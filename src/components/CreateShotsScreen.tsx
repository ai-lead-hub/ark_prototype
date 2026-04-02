import { useState } from "react";

type Props = {
  onBack: () => void;
  onSubmit: (data: any) => void;
  projectData?: any;
};

export default function CreateShotsScreen({ onBack, onSubmit }: Props) {
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

  const handleSave = () => {
    onSubmit({
      sequences,
      selectedSequence,
      shots,
      shotPadding: parseInt(shotPadding),
    });
  };

  return (
    <div className="flex h-dvh flex-col bg-[#1a1a1a] text-slate-100">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/20 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold">
          AJ
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold text-white mb-8">Create Shots</h1>

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
            <div className="grid grid-cols-2 gap-6">
              {/* Sequences */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Sequences</h3>
                <div className="h-80 rounded-xl bg-[#2a2a2a] p-3 overflow-y-auto">
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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Shots</h3>
                <div className="h-80 rounded-xl bg-[#2a2a2a] p-3 overflow-y-auto">
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
            <div className="flex justify-end gap-3 pt-8 border-t border-white/10">
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl bg-white/10 px-8 py-3 text-sm font-medium text-slate-300 hover:bg-white/20 transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-emerald-500 px-8 py-3 text-sm font-medium text-white hover:bg-emerald-600 transition"
              >
                Save and Enter Production
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
