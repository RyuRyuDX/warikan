// タブ切替中に即座に表示されるプレースホルダ。
// SSR/データ取得が走る間、画面が固まって見えるのを防ぐ。
export default function Loading() {
  return (
    <div className="max-w-md mx-auto safe-top animate-pulse">
      <div className="px-5 pt-6 pb-4 flex items-center justify-center">
        <div className="h-6 w-32 bg-gray-200 rounded" />
      </div>
      <div className="mx-5 mb-6 h-28 bg-gray-100 rounded-2xl" />
      <div className="mx-5 space-y-3">
        <div className="h-14 bg-gray-100 rounded-xl" />
        <div className="h-14 bg-gray-100 rounded-xl" />
        <div className="h-14 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
