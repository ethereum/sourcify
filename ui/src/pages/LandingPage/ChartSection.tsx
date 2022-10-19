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
import AppIconName from "../../components/AppIconName";
import LoadingOverlay from "../../components/LoadingOverlay";
import { REPOSITORY_SERVER_URL } from "../../constants";
import { Context } from "../../Context";
import featured from "../../featured";

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
  if (Object.keys(sourcifyChainMap).length === 0) {
    return (
      <div className="h-72 md:h-96 lg:h-[36rem] w-full relative">
        <LoadingOverlay message="Getting Sourcify chains" />
      </div>
    );
  }
  // Filter Ethereum networks only
  const formattedData = Object.keys(stats)
    .filter((key) => ["1", "3", "4", "5", "42", "11155111"].includes(key))
    .map((key) => {
      const keyInt = parseInt(key);
      return {
        name:
          Object.keys(sourcifyChainMap).length > 0 &&
          sourcifyChainMap[keyInt] &&
          (sourcifyChainMap[keyInt]?.name || sourcifyChainMap[keyInt].title), // Shorter name takes precedence
        fullMatch: stats[key].full_match,
        partialMatch: stats[key].partial_match,
      };
    });
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
              width={70}
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

const Featured = () => {
  return featured.map((project) => {
    if (project.displayed) {
      return (
        <AppIconName
          img={project.logo}
          name={project.name}
          href={project.href}
          key={`app-icon-${project.name}`}
        />
      );
    }

    return null;
  });
};

const ChartSection = () => {
  const [stats, setStats] = useState<statsType>();
  useEffect(() => {
    fetch(`${REPOSITORY_SERVER_URL}/stats.json`)
      .then((res) => res.json())
      .then((json) => setStats(json));
  }, []);

  return (
    <div className="flex flex-col items-center w-full">
      <Chart stats={stats} />
      {/* Verified contract examples */}
      <div className="mt-12">
        <h2 className="my-4 text-2xl font-bold text-lightCoral-500 text-center">
          Including:
        </h2>
        <div className="flex flex-row mt-8 flex-wrap items-center justify-center logos-container">
          {Featured()}
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
