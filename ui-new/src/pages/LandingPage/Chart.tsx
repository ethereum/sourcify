import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingOverlay from "../../components/LoadingOverlay";
import { ID_TO_CHAIN, REPOSITORY_URL } from "../../constants";

type statsType = {
  [key: string]: {
    full_match: number;
    partial_match: number;
  };
};

const Chart = () => {
  const [stats, setStats] = useState<statsType>();
  useEffect(() => {
    console.log(`${REPOSITORY_URL}/stats.json`);
    fetch(`${REPOSITORY_URL}/stats.json`)
      .then((res) => res.json())
      .then((json) => setStats(json));
  }, []);

  console.log(stats);

  if (!stats) {
    return (
      <div className="h-72 md:h-96 lg:h-[36rem] w-full relative">
        <LoadingOverlay message="Getting stats" />
      </div>
    );
  }
  // Filter Ethereum networks only
  const formattedData = Object.keys(stats)
    .filter((key) => ["1", "3", "4", "5", "42"].includes(key))
    .map((key) => {
      const keyInt = parseInt(key);
      return {
        name: ID_TO_CHAIN[keyInt].label,
        fullMatch: stats[key].full_match,
        partialMatch: stats[key].partial_match,
      };
    });

  const total = formattedData.reduce((prev, curr, i) => {
    return prev + curr.fullMatch + curr.partialMatch;
  }, 0);

  console.log(formattedData);
  return (
    <div className="flex flex-col items-center h-72 md:h-96 lg:h-[36rem] w-11/12">
      <h2 className="my-4 text-2xl font-bold text-ceruleanBlue-500">
        {" "}
        <span className="text-lightCoral-500">
          {total.toLocaleString()}
        </span>{" "}
        contracts verified on Ethereum networks so far!
      </h2>
      <ResponsiveContainer>
        <BarChart
          // width={700}
          // height={300}
          data={formattedData}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis
            yAxisId="left"
            dataKey="fullMatch"
            domain={[
              0,
              (dataMax: number) => {
                const digits = dataMax.toString().length - 1;
                const roundedMax =
                  Math.ceil(dataMax / 10 ** digits) * 10 ** digits;
                return roundedMax;
              },
            ]}
            tickFormatter={(tick) => tick.toLocaleString()}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            dataKey="partialMatch"
            domain={[0, (dataMax: number) => dataMax * 5]}
            tickFormatter={(tick) => tick.toLocaleString()}
          />
          <Tooltip />
          <Legend />
          <Bar
            name="Full Matches"
            yAxisId="left"
            dataKey="fullMatch"
            fill="#2B50AA"
          />
          <Bar
            name="Partial Matches"
            yAxisId="right"
            dataKey="partialMatch"
            fill="#A9BDEE"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;
