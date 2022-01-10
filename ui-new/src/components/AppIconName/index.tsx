type AppIconNameProps = {
  img: string;
  name: string;
  href?: string;
  rounded?: boolean;
};
const AppIconName = ({ img, name, href, rounded }: AppIconNameProps) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="flex flex-col mr-12 my-2 hover:text-ceruleanBlue-500"
  >
    <img
      src={img}
      className={`h-20 self-center transition-opacity ease-in-out p-1 ${
        rounded ? "rounded-full" : ""
      }`}
      alt={`${name} logo`}
    />
    <div className="text-center mt-2 ">{name}</div>
  </a>
);

export default AppIconName;
