const STYLES: Record<string, { mr: string; en: string; cls: string }> = {
  draft: { mr: "स्कॅन सुरू", en: "Capturing", cls: "bg-gray-100 text-gray-800" },
  queued: { mr: "पाठवणे बाकी", en: "Waiting to upload", cls: "bg-warn-50 text-warn-700" },
  captured: { mr: "पाठवले", en: "Uploaded", cls: "bg-forest-50 text-forest-800" },
  reading: { mr: "वाचन सुरू", en: "AI reading…", cls: "bg-blue-50 text-blue-800" },
  read: { mr: "तपासा", en: "Ready to verify", cls: "bg-yellow-100 text-yellow-900 ring-2 ring-yellow-500" },
  read_failed: { mr: "वाचन अयशस्वी", en: "AI failed — check", cls: "bg-danger-50 text-danger-600" },
  routed: { mr: "विभागाकडे पाठवले", en: "Routed", cls: "bg-forest-700 text-white" },
  in_progress: { mr: "कार्यवाही सुरू", en: "In progress", cls: "bg-forest-100 text-forest-900" },
  closed: { mr: "निकाली", en: "Closed", cls: "bg-gray-700 text-white" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { mr: status, en: status, cls: "bg-gray-100" };
  return (
    <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold leading-tight ${s.cls}`}>
      {s.mr} · {s.en}
    </span>
  );
}
