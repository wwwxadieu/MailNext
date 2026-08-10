import { useState } from "react";
import { CheckCircle2, Download, HardDriveUpload, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { exportBackup, importBackup } from "@/lib/backup";
import type { BackupResult } from "@/lib/backup";
import { useT } from "@/lib/useT";

export function BackupSettings() {
  const t = useT();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportResult, setExportResult] = useState<BackupResult | null>(null);
  const [importResult, setImportResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    setExportResult(null);
    try {
      const res = await exportBackup();
      if (res) setExportResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport() {
    setIsImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await importBackup();
      if (res) setImportResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Intro Header */}
      <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <ShieldCheck size={24} strokeWidth={1.5} className="mt-0.5 flex-shrink-0 text-accent" />
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-sm text-neutral-800 dark:text-neutral-100">
            {t("backup.title") ?? "Sao lưu & Khôi phục dữ liệu (Chuẩn Outlook)"}
          </p>
          <p className="leading-relaxed text-neutral-600 dark:text-neutral-300">
            {t("backup.description") ??
              "Xuất toàn bộ cấu hình tài khoản, bộ nhớ thư local, quy tắc lọc, chữ ký và mẫu thư thành 1 tệp sao lưu (.mnbak). Bạn có thể dễ dàng lưu trữ local hoặc khôi phục lại dữ liệu bất cứ lúc nào."}
          </p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Export Card */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 transition-all hover:border-accent/40">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-sm text-neutral-800 dark:text-neutral-100">
              <Download size={16} className="text-accent" />
              <span>{t("backup.exportTitle") ?? "Xuất dữ liệu Sao lưu"}</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Tạo tệp sao lưu `.mnbak` chứa đầy đủ thông tin tài khoản, danh sách email, thư mục cá nhân và các cài đặt.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isExporting || isImporting}
            className="w-full justify-center"
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} strokeWidth={1.5} />
            )}
            <span>{isExporting ? "Đang xuất sao lưu…" : (t("backup.exportButton") ?? "Xuất tệp sao lưu (.mnbak)")}</span>
          </Button>
        </div>

        {/* Import Card */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 transition-all hover:border-accent/40">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-sm text-neutral-800 dark:text-neutral-100">
              <HardDriveUpload size={16} className="text-accent" />
              <span>{t("backup.importTitle") ?? "Khôi phục từ Sao lưu"}</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Chọn tệp sao lưu `.mnbak` đã xuất trước đó để phục hồi lại đầy đủ tài khoản và dữ liệu email.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={handleImport}
            disabled={isExporting || isImporting}
            className="w-full justify-center"
          >
            {isImporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <HardDriveUpload size={14} strokeWidth={1.5} />
            )}
            <span>{isImporting ? "Đang khôi phục…" : (t("backup.importButton") ?? "Khôi phục từ tệp (.mnbak)")}</span>
          </Button>
        </div>
      </div>

      {/* Export Result Notification */}
      {exportResult && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/10 p-3.5 text-xs text-success-hover font-medium animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-success" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Xuất sao lưu thành công!</p>
            <p className="text-neutral-700 dark:text-neutral-200">
              Đã sao lưu {exportResult.accountsCount} tài khoản, {exportResult.foldersCount} thư mục,{" "}
              {exportResult.messagesCount} thư, {exportResult.rulesCount} quy tắc vào tệp:
            </p>
            <p className="font-mono text-[11px] break-all bg-black/5 dark:bg-white/10 p-1.5 rounded-md text-neutral-800 dark:text-neutral-100">
              {exportResult.filePath}
            </p>
          </div>
        </div>
      )}

      {/* Import Result Notification */}
      {importResult && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/10 p-3.5 text-xs text-success-hover font-medium animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-success" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Khôi phục dữ liệu thành công!</p>
            <p className="text-neutral-700 dark:text-neutral-200">
              Đã khôi phục hoàn tất {importResult.accountsCount} tài khoản, {importResult.foldersCount} thư mục,{" "}
              {importResult.messagesCount} thư, {importResult.rulesCount} quy tắc từ tệp sao lưu.
            </p>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-3.5 text-xs text-danger font-medium">
          <p className="font-semibold">Đã xảy ra lỗi:</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}
    </div>
  );
}
