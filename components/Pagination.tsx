import { PaginationProps } from "@/lib/types/component-props";

export const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }: PaginationProps) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        onItemsPerPageChange(newItemsPerPage);
        onPageChange(1);
    };

    const pageBtnClass = "px-3 py-1.5 text-sm border border-gray-200 rounded cursor-pointer font-medium transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] active:bg-gray-100";

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 my-4 px-4 py-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Items per pagina:</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-700 bg-white transition-all duration-150 hover:border-gray-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                    </select>
                </label>
                <span className="text-sm text-gray-500">
                    {startItem}–{endItem} van {totalItems}
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={pageBtnClass}>
                    «
                </button>
                <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={pageBtnClass}>
                    ‹ Vorige
                </button>
                <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
                    {currentPage} / {totalPages}
                </span>
                <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className={pageBtnClass}>
                    Volgende ›
                </button>
                <button onClick={() => onPageChange(totalPages)} disabled={currentPage >= totalPages} className={pageBtnClass}>
                    »
                </button>
            </div>
        </div>
    );
};
