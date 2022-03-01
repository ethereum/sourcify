import { useContext, useEffect, useState } from "react";
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
import ens from "../../assets/contracts/ens.png";
import synthetix from "../../assets/contracts/synthetix.png";
import uniswap from "../../assets/contracts/uniswap.png";
import AppIconName from "../../components/AppIconName";
import LoadingOverlay from "../../components/LoadingOverlay";
import { REPOSITORY_URL } from "../../constants";
import { Context } from "../../Context";

type statsType = {
  [key: string]: {
    full_match: number;
    partial_match: number;
  };
};

const Chart = ({ stats }: { stats: statsType | undefined }) => {
  const { sourcifyChainMap } = useContext(Context);

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
        name: sourcifyChainMap[keyInt].title || sourcifyChainMap[keyInt].name,
        fullMatch: stats[key].full_match,
        partialMatch: stats[key].partial_match,
      };
    });

  console.log(formattedData);
  const total = formattedData.reduce((prev, curr, i) => {
    return prev + curr.fullMatch + curr.partialMatch;
  }, 0);

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="my-4 text-2xl font-bold text-ceruleanBlue-500">
        {" "}
        <span className="text-lightCoral-500">
          {total.toLocaleString()}
        </span>{" "}
        contracts verified on Ethereum networks so far!
      </h2>
      <div className="h-72 md:h-96 lg:h-[30rem] w-11/12 max-w-2xl my-8">
        <ResponsiveContainer>
          <BarChart
            // width={700}
            // height={300}
            data={formattedData}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip cursor={{ fill: "rgba(232, 239, 255, 0.4)" }} />
            <XAxis dataKey="name" />
            <YAxis
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
            <Tooltip />
            <Legend />
            <Bar
              name="Full Matches"
              dataKey="fullMatch"
              fill="#2B50AA"
              stackId="a"
            />
            <Bar
              name="Partial Matches"
              dataKey="partialMatch"
              fill="#7693DA"
              stackId="a"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/////////////////////////////
////// MAIN COMPONENT ///////
/////////////////////////////

const ChartSection = () => {
  const [stats, setStats] = useState<statsType>();
  useEffect(() => {
    console.log(`${REPOSITORY_URL}/stats.json`);
    fetch(`${REPOSITORY_URL}/stats.json`)
      .then((res) => res.json())
      .then((json) => setStats(json));
  }, []);

  console.log(stats);

  return (
    <div className="flex flex-col items-center w-full">
      <Chart stats={stats} />
      {/* Verified contract examples */}
      <div className="mt-12">
        <h2 className="my-4 text-2xl font-bold text-lightCoral-500 text-center">
          Including:
        </h2>
        <div className="flex flex-row mt-8 flex-wrap items-center justify-center logos-container">
          <AppIconName
            img={uniswap}
            name="Uniswap"
            href="https://repo.sourcify.dev/contracts/full_match/1/0x000000001f91b581BF90b0D07A6259dc083Cc838/"
          />
          <AppIconName
            img={ens}
            name="ENS"
            href="https://repo.sourcify.dev/contracts/full_match/1/0x000000001f91b581BF90b0D07A6259dc083Cc838/"
          />
          <AppIconName
            img={synthetix}
            name="Synthetix"
            href="https://repo.sourcify.dev/contracts/full_match/1/0x000000001f91b581BF90b0D07A6259dc083Cc838/"
          />
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
