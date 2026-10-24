import CardBox from '../../shared/CardBox';
import iconConnect from 'src/assets/images/svgs/icon-connect.svg';
import iconBriefcase from 'src/assets/images/svgs/icon-briefcase.svg';
import iconFavorites from 'src/assets/images/svgs/icon-favorites.svg';
import iconInvoice from 'src/assets/images/svgs/icon-dd-invoice.svg';
import iconInbox from 'src/assets/images/svgs/icon-inbox.svg';
import iconUser from 'src/assets/images/svgs/icon-user-male.svg';
import iconAccount from 'src/assets/images/svgs/icon-account.svg';
import type { DashboardResponse } from 'src/features/dashboard/types';
import {
  formatCount,
  formatCurrency,
  formatCurrencyCompact,
  pluralize,
} from 'src/features/dashboard/formatters';

interface TopCardsProps {
  dashboard: DashboardResponse;
  currency: string;
}

export const TopCards = ({ dashboard, currency }: TopCardsProps) => {
  const TopCardInfo = [
    {
      key: 'revenue',
      title: 'Revenue',
      desc: formatCurrencyCompact(dashboard.totalRevenue, currency),
      titleText: formatCurrency(dashboard.totalRevenue, currency),
      img: iconConnect,
      bgcolor: 'bg-info/10 dark:bg-info/10',
      textclr: 'text-info dark:text-info',
    },
    {
      key: 'expenses',
      title: 'Expenses',
      desc: formatCurrencyCompact(dashboard.totalExpenses, currency),
      titleText: formatCurrency(dashboard.totalExpenses, currency),
      img: iconBriefcase,
      bgcolor: 'bg-success/10 dark:bg-success/10',
      textclr: 'text-success dark:text-success',
    },
    {
      key: 'netProfit',
      title: 'Net profit',
      desc: formatCurrencyCompact(dashboard.netProfit, currency),
      titleText: formatCurrency(dashboard.netProfit, currency),
      img: iconFavorites,
      bgcolor: dashboard.netProfit >= 0 ? 'bg-lightsuccess dark:bg-lightsuccess' : 'bg-lighterror dark:bg-lighterror',
      textclr: dashboard.netProfit >= 0 ? 'text-success dark:text-success' : 'text-error dark:text-error',
    },
    {
      key: 'invoiced',
      title: 'Invoiced',
      desc: formatCurrencyCompact(dashboard.totalInvoiced, currency),
      titleText: formatCurrency(dashboard.totalInvoiced, currency),
      img: iconInvoice,
      bgcolor: 'bg-lightprimary dark:bg-lightprimary',
      textclr: 'text-primary dark:text-primary',
    },
    {
      key: 'outstanding',
      title: 'Outstanding',
      desc: formatCurrencyCompact(dashboard.totalOutstanding, currency),
      titleText: formatCurrency(dashboard.totalOutstanding, currency),
      img: iconInbox,
      bgcolor: 'bg-warning/10 dark:bg-warning/10',
      textclr: 'text-warning dark:text-warning',
    },
    {
      key: 'customers',
      title: 'Customers',
      desc: formatCount(dashboard.customerCount),
      titleText: `${formatCount(dashboard.customerCount)} active ${pluralize(dashboard.customerCount, 'customer')}`,
      img: iconUser,
      bgcolor: 'bg-primary/10 dark:bg-lightprimary',
      textclr: 'text-primary dark:text-primary',
    },
    {
      key: 'vendors',
      title: 'Vendors',
      desc: formatCount(dashboard.vendorCount),
      titleText: `${formatCount(dashboard.vendorCount)} active ${pluralize(dashboard.vendorCount, 'vendor')}`,
      img: iconAccount,
      bgcolor: 'bg-lighterror dark:bg-lighterror',
      textclr: 'text-error dark:text-error',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {TopCardInfo.map((item) => {
        return (
          <div
            key={item.key}
            role="group"
            aria-label={`${item.title}: ${item.titleText}`}
            title={item.titleText}
            className="h-full"
          >
            <CardBox className={`shadow-none ${item.bgcolor} w-full border-none p-4`}>
              <div className="text-center hover:scale-105 transition-all ease-in-out">
                <div className="flex justify-center">
                  <img src={item.img} width="50" height="50" className="mb-3" alt="" />
                </div>
                <p className={`text-sm font-semibold ${item.textclr} mb-1`}>{item.title}</p>
                <h5 className={`text-lg font-semibold ${item.textclr} mb-0`}>{item.desc}</h5>
              </div>
            </CardBox>
          </div>
        );
      })}
    </div>
  );
};
